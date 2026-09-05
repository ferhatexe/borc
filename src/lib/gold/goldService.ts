import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";
import {
  CurrencyRate,
  GoldPriceProvider,
  GoldPriceRecord,
  GoldPriceUnavailableError,
  GoldProviderResult,
  GoldSourceKind,
  GoldSyncResult,
  GRAMS_PER_TROY_OUNCE,
  isPieceGoldType,
  OunceQuote,
} from "./types";
import { TruncgilGoldAdapter } from "./truncgilAdapter";
import { TruncgilFlatGoldAdapter } from "./truncgilFlatAdapter";
import { AnlikAltin21Adapter, isPlausibleGramPrice } from "./anlikAltinAdapter";
import { calculateGoldValueTL } from "@/lib/finance/gold";
import { getSettingsForOwner } from "@/lib/db/settings";
import {
  AppSettings,
  DEFAULT_GOLD_MILLESIMAL,
  DEFAULT_GOLD_UNIT_GRAMS,
  GoldManualPrices,
} from "@/lib/settings/defaults";
import { buildGoldRecords, CURRENCY_NAMES } from "./mapping";

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

/** 21 ayar icin ayri kaynak; birincil saglayici bu urunu yayinlamiyor. */
const anlikAltin21 = new AnlikAltin21Adapter();

/**
 * 21 ayar gram fiyatini gercek piyasa kotasyonuyla degistirir.
 *
 * Milyemden turetilen deger yalnizca bir yaklasimdir; sartname 21 ayar icin
 * "web'den bulunan fiyat" diyor. Kazima basarisiz olur ya da makul araligin
 * disinda bir sayi donerse katalog oldugu gibi birakilir.
 */
async function enrichWith21Ayar(result: GoldProviderResult): Promise<void> {
  const record = result.prices.find((p) => p.goldType === "ZINCIR_21_HALEP");
  if (!record) return;

  const scraped = await anlikAltin21.fetchGramPrice();
  if (scraped === null) {
    console.warn("21 ayar fiyati alinamadi, milyemden turetilen deger kullanilacak.");
    return;
  }

  if (!isPlausibleGramPrice(scraped, record.sellPrice)) {
    console.warn(
      `21 ayar fiyati makul araligin disinda (kazinan ${scraped}, turetilen ${record.sellPrice}); yok sayildi.`
    );
    return;
  }

  record.sellPrice = scraped;
  record.buyPrice = scraped;
  record.isDerived = false;
  record.source = anlikAltin21.name;
}

export function resetGoldCache() {
  inMemoryCache = null;
}

/**
 * Gold per troy ounce in USD.
 *
 * The provider publishes an `ONS` field but it comes through as 0, so the value
 * is DERIVED from the two live numbers we do have:
 *   ONS(USD) = (gram has altın TL / USD-TRY satış) x 31.1035
 * This is the same relationship the TL gram price is set from, and the UI
 * labels it as "hesaplanan" so it is never read as a primary market quote.
 */
function deriveOunce(pureGramSellTL: number, currencies: CurrencyRate[]): OunceQuote | null {
  const usd = currencies.find((c) => c.code === "USD");
  if (!usd || usd.sellPrice <= 0 || pureGramSellTL <= 0) return null;

  const tryValue = pureGramSellTL * GRAMS_PER_TROY_OUNCE;
  return {
    usd: Math.round((tryValue / usd.sellPrice) * 100) / 100,
    tryValue: Math.round(tryValue * 100) / 100,
    basis: "DERIVED",
  };
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
    pureGramChangePercent: snap.pureGramChangePercent,
    currencies: snap.currencies,
    ounce: deriveOunce(snap.pureGramSellTL, snap.currencies),
    providerUpdatedAt: snap.providerUpdatedAt,
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

  if (result.currencies.length > 0) {
    await prisma.currencySnapshot.createMany({
      data: result.currencies.map((c) => ({
        code: c.code,
        name: c.name,
        buyPrice: new Decimal(c.buyPrice),
        sellPrice: new Decimal(c.sellPrice),
        changePct: c.changePercent === null ? null : new Decimal(c.changePercent),
        source,
        fetchedAt,
      })),
    });
  }
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
    // Snapshot, canli cekimde ne kaydedildiyse odur; yeniden turetilmez.
    isDerived: false,
    source: row.source,
  }));

  // KULCE is stored straight from the pure gram price, so it restores the basis.
  const pureRow = newestByType.get("KULCE") || newestByType.get("GRAM_ALTIN");
  if (!pureRow) return null;

  // Kurlar da aynı şekilde son kayıttan geri yüklenir.
  const currencyRows = await prisma.currencySnapshot.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 60,
  });
  const newestCurrency = new Map<string, (typeof currencyRows)[number]>();
  for (const row of currencyRows) {
    if (!newestCurrency.has(row.code)) newestCurrency.set(row.code, row);
  }

  const currencies: CurrencyRate[] = Array.from(newestCurrency.values()).map((row) => ({
    code: row.code,
    name: row.name || CURRENCY_NAMES[row.code] || row.code,
    buyPrice: Number(row.buyPrice),
    sellPrice: Number(row.sellPrice),
    changePercent: row.changePct === null ? null : Number(row.changePct),
  }));

  return {
    prices,
    pureGramBuyTL: Number(pureRow.buyPrice),
    pureGramSellTL: Number(pureRow.sellPrice),
    pureGramChangePercent: null,
    currencies,
    providerUpdatedAt: null,
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
    // Manuel modda kur bilgisi yoktur; ONS bu yüzden hesaplanamaz.
    currencies: [],
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
      await enrichWith21Ayar(result);
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

  /*
   * Gram ürünlerinde fiyat kaynağı önceliği:
   *   1. Kullanıcının girdiği manuel gram fiyatı
   *   2. Ürünün kendi piyasa kotasyonu (21 ayar, 22 ayar bilezik, 14/18 ayar)
   *   3. Milyem formülü: (gram × milyem × has altın) / 1000
   *
   * Şartname 21 ve 22 ayar için "web'den bulunan fiyat" diyor. Gerçek kotasyon
   * kuyumcunun kendi marjını da taşıdığı için milyem hesabının tutturamayacağı
   * bir farkı vardır; kotasyon varsa o kullanılır.
   */
  let perGramPriceTL: number | undefined;
  if (!isPiece) {
    if (useManual) perGramPriceTL = Number(debt.manualUnitPrice);
    else if (meta && meta.isDerived === false) perGramPriceTL = meta.sellPrice;
  }

  const res = calculateGoldValueTL({
    goldType: debt.goldType,
    quantity: isPiece ? Number(debt.quantity ?? 0) : undefined,
    grams: isPiece ? undefined : Number(debt.grams ?? 0),
    karat: debt.karat ?? meta?.karat ?? undefined,
    unitPriceTL,
    pureGoldGramSellTL: pureGramSellTL,
    perGramPriceTL,
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
