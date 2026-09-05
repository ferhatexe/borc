import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";
import {
  GoldPriceProvider,
  GoldPriceRecord,
  GoldPriceUnavailableError,
  GoldProviderResult,
  GoldSourceKind,
  GoldSyncResult,
  isPieceGoldType,
} from "./types";
import { TruncgilGoldAdapter } from "./truncgilAdapter";
import { TruncgilFlatGoldAdapter } from "./truncgilFlatAdapter";
import { calculateGoldValueTL } from "@/lib/finance/gold";
import { getSettingsForOwner } from "@/lib/db/settings";
import {
  AppSettings,
  DEFAULT_GOLD_MILLESIMAL,
  DEFAULT_GOLD_UNIT_GRAMS,
  GoldManualPrices,
} from "@/lib/settings/defaults";
import { buildGoldRecords } from "./mapping";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 dakika (sartname 7)
/** Beyond this age a snapshot is shown with a warning band. */
const SNAPSHOT_WARN_AFTER_MS = 60 * 60 * 1000;

interface CachedSnapshot extends GoldProviderResult {
  source: string;
  sourceKind: GoldSourceKind;
  fetchedAt: Date;
}

let inMemoryCache: CachedSnapshot | null = null;

const providers: GoldPriceProvider[] = [new TruncgilGoldAdapter(), new TruncgilFlatGoldAdapter()];

export function resetGoldCache() {
  inMemoryCache = null;
}

function minutesSince(date: Date): number {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function buildResult(snap: CachedSnapshot, isCached: boolean): GoldSyncResult {
  const ageMinutes = minutesSince(snap.fetchedAt);
  const ageMs = Date.now() - snap.fetchedAt.getTime();
  const isStale = snap.sourceKind !== "LIVE" || ageMs > SNAPSHOT_WARN_AFTER_MS;

  let warning: string | null = null;
  if (snap.sourceKind === "MANUAL") {
    warning = "Altin fiyatlari ayarlardan girdiginiz manuel degerlerden hesaplaniyor.";
  } else if (snap.sourceKind === "SNAPSHOT") {
    warning = `Canli altin servisine ulasilamadi. Fiyatlar ${ageMinutes} dakika once kaydedilen son veriye gore gosteriliyor.`;
  } else if (isStale) {
    warning = `Fiyatlar ${ageMinutes} dakika once guncellendi.`;
  }

  const elapsed = Date.now() - snap.fetchedAt.getTime();
  return {
    prices: snap.prices,
    pureGramBuyTL: snap.pureGramBuyTL,
    pureGramSellTL: snap.pureGramSellTL,
    source: snap.source,
    sourceKind: snap.sourceKind,
    fetchedAt: snap.fetchedAt.toISOString(),
    isCached,
    cacheExpiresInSeconds: Math.max(0, Math.round((CACHE_TTL_MS - elapsed) / 1000)),
    isStale,
    ageMinutes,
    warning,
  };
}

/** Persists a live pull so the app can fall back to it when providers are down. */
async function persistSnapshot(result: GoldProviderResult, source: string, fetchedAt: Date) {
  await prisma.goldPriceSnapshot.createMany({
    data: result.prices.map((p) => ({
      goldType: p.goldType as never,
      karat: p.karat,
      buyPrice: new Decimal(p.buyPrice),
      sellPrice: new Decimal(p.sellPrice),
      source,
      fetchedAt,
    })),
  });
}

/** Rebuilds a catalogue from the newest row of each product in the database. */
async function loadLatestSnapshot(): Promise<CachedSnapshot | null> {
  const rows = await prisma.goldPriceSnapshot.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 200,
  });
  if (rows.length === 0) return null;

  const newestByType = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!newestByType.has(row.goldType)) newestByType.set(row.goldType, row);
  }

  const prices: GoldPriceRecord[] = Array.from(newestByType.values()).map((row) => ({
    goldType: row.goldType,
    name: row.goldType,
    karat: row.karat,
    buyPrice: Number(row.buyPrice),
    sellPrice: Number(row.sellPrice),
    isPiece: isPieceGoldType(row.goldType),
    effectiveGrams: DEFAULT_GOLD_UNIT_GRAMS[row.goldType] ?? 1,
  }));

  // KULCE is stored straight from the pure gram price, so it restores the basis.
  const pureRow = newestByType.get("KULCE") || newestByType.get("GRAM_ALTIN");
  if (!pureRow) return null;

  return {
    prices,
    pureGramBuyTL: Number(pureRow.buyPrice),
    pureGramSellTL: Number(pureRow.sellPrice),
    source: `${rows[0].source} (kayitli)`,
    sourceKind: "SNAPSHOT",
    fetchedAt: rows[0].fetchedAt,
  };
}

/** Builds a catalogue from the manual prices the user entered in settings. */
function buildFromManual(manual: GoldManualPrices): CachedSnapshot | null {
  if (!manual.pureGramSellTL || manual.pureGramSellTL <= 0) return null;

  const pure = { buy: manual.pureGramSellTL, sell: manual.pureGramSellTL };
  const q = (key: string) => {
    const value = manual.prices?.[key];
    return value && value > 0 ? { buy: value, sell: value } : null;
  };

  const built = buildGoldRecords({
    pure,
    gram: q("GRAM_ALTIN"),
    ceyrek: q("CEYREK"),
    yarim: q("YARIM"),
    tam: q("TAM"),
    ata: q("ATA"),
    gremse: q("GREMSE"),
    bilezik22: q("BILEZIK_22"),
    bilezik18: q("BILEZIK_18"),
    bilezik14: q("BILEZIK_14"),
  });

  return {
    ...built,
    source: "Manuel giris (ayarlar)",
    sourceKind: "MANUAL",
    fetchedAt: manual.updatedAt ? new Date(manual.updatedAt) : new Date(),
  };
}

/**
 * Resolution order (sartname 7):
 *   0. manual prices, when the user switched them on
 *   1. live providers, in order
 *   2. the newest snapshot stored in the database
 *   3. manual prices, even when not switched on
 * Nothing is ever invented; if every step fails the caller gets an error.
 */
export async function getGoldPrices(forceRefresh = false): Promise<GoldSyncResult> {
  if (!forceRefresh && inMemoryCache) {
    const elapsed = Date.now() - inMemoryCache.fetchedAt.getTime();
    if (elapsed < CACHE_TTL_MS && inMemoryCache.sourceKind === "LIVE") {
      return buildResult(inMemoryCache, true);
    }
  }

  let settings: AppSettings | null = null;
  try {
    settings = await getSettingsForOwner();
  } catch {
    settings = null;
  }

  const manual = settings?.goldManualPrices;
  if (manual?.enabled) {
    const manualSnap = buildFromManual(manual);
    if (manualSnap) {
      inMemoryCache = manualSnap;
      return buildResult(manualSnap, false);
    }
  }

  const providerErrors: string[] = [];
  for (const provider of providers) {
    try {
      const result = await provider.fetchPrices();
      const fetchedAt = new Date();
      const snap: CachedSnapshot = {
        ...result,
        source: provider.name,
        sourceKind: "LIVE",
        fetchedAt,
      };
      inMemoryCache = snap;

      try {
        await persistSnapshot(result, provider.id, fetchedAt);
      } catch (err) {
        console.error("Altin snapshot kaydedilemedi:", err);
      }

      return buildResult(snap, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      providerErrors.push(`${provider.name}: ${message}`);
      console.warn(`Altin saglayicisi basarisiz - ${provider.name}:`, message);
    }
  }

  try {
    const snapshot = await loadLatestSnapshot();
    if (snapshot) {
      inMemoryCache = snapshot;
      return buildResult(snapshot, false);
    }
  } catch (err) {
    console.error("Altin snapshot okunamadi:", err);
  }

  if (manual) {
    const manualSnap = buildFromManual(manual);
    if (manualSnap) {
      inMemoryCache = manualSnap;
      return buildResult(manualSnap, false);
    }
  }

  throw new GoldPriceUnavailableError(
    `Altin fiyatlari alinamadi ve kayitli fiyat da yok. Ayarlar > Altin bolumunden manuel fiyat girebilirsiniz. (${providerErrors.join(" | ") || "saglayici yok"})`
  );
}

export interface GoldDebtLike {
  goldType: string;
  quantity?: number | Decimal | null;
  grams?: number | Decimal | null;
  karat?: number | null;
  premiumTL?: number | Decimal | null;
  priceSource?: string | null;
  manualUnitPrice?: number | Decimal | null;
}

export interface GoldValuationOptions {
  millesimalMap?: Record<string, number>;
  /** Per-product TL margin from user settings; used when the debt has no own value. */
  margins?: Record<string, number>;
}

/**
 * Live TL value of one gold debt.
 *
 * Piece products : quantity x (unit sell price + margin)
 * Gram products  : (grams x millesimal x pure gram sell) / 1000 + grams x margin
 *
 * The margin comes from the debt itself when the user set one, otherwise from
 * the `gold_margins` setting (21 ayar defaults to +200 TL/gr, 22 ayar to 0).
 */
export function calculateGoldDebtLiveTL(
  debt: GoldDebtLike,
  priceList: GoldPriceRecord[],
  pureGramSellTL: number,
  options: GoldValuationOptions = {}
): { totalTL: number; unitPriceWithPremiumTL: number; goldName: string; isPiece: boolean } {
  const meta = priceList.find((p) => p.goldType === debt.goldType) || null;
  const isPiece = meta?.isPiece ?? isPieceGoldType(debt.goldType);
  const millesimalMap = options.millesimalMap ?? DEFAULT_GOLD_MILLESIMAL;

  const useManual = debt.priceSource === "MANUEL" && debt.manualUnitPrice != null;
  const unitPriceTL = useManual ? Number(debt.manualUnitPrice) : (meta?.sellPrice ?? 0);

  const margin =
    debt.premiumTL !== undefined && debt.premiumTL !== null
      ? Number(debt.premiumTL)
      : (options.margins?.[debt.goldType] ?? 0);

  const res = calculateGoldValueTL({
    goldType: debt.goldType,
    quantity: isPiece ? Number(debt.quantity ?? 0) : undefined,
    grams: isPiece ? undefined : Number(debt.grams ?? 0),
    karat: debt.karat ?? meta?.karat ?? undefined,
    unitPriceTL,
    pureGoldGramSellTL: pureGramSellTL,
    // A manual price on a gram product is already per-gram, so it must not be
    // scaled by the millesimal a second time.
    perGramPriceTL: useManual && !isPiece ? Number(debt.manualUnitPrice) : undefined,
    premiumTL: margin,
    millesimalMap,
  });

  return {
    totalTL: res.totalTL.toNumber(),
    unitPriceWithPremiumTL: res.unitPriceWithPremiumTL.toNumber(),
    goldName: meta?.name || debt.goldType,
    isPiece,
  };
}
