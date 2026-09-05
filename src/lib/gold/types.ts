/** Canonical gold product keys, mirrors the Prisma GoldType enum. */
export const GOLD_TYPES = [
  "GRAM_ALTIN",
  "CEYREK",
  "YARIM",
  "TAM",
  "ATA",
  "GREMSE",
  "BILEZIK_22",
  "ZINCIR_21_HALEP",
  "BILEZIK_14",
  "BILEZIK_18",
  "KULCE",
  "DIGER",
] as const;

export type GoldTypeKey = (typeof GOLD_TYPES)[number];

/** Gold products priced per piece; everything else is priced per gram. */
export const PIECE_GOLD_TYPES: readonly string[] = ["CEYREK", "YARIM", "TAM", "ATA", "GREMSE"];

export function isPieceGoldType(goldType: string): boolean {
  return PIECE_GOLD_TYPES.includes(goldType.toUpperCase());
}

export interface GoldPriceRecord {
  goldType: string;
  name: string;
  karat: number;
  /** TL. For piece products this is the price of one piece, otherwise of one gram. */
  buyPrice: number;
  sellPrice: number;
  isPiece: boolean;
  /** Weight of one piece in grams (piece products only). */
  effectiveGrams?: number;
}

export interface GoldProviderResult {
  /** Gram "has altın" (pure) prices - the basis of every gram based calculation. */
  pureGramBuyTL: number;
  pureGramSellTL: number;
  prices: GoldPriceRecord[];
}

export interface GoldPriceProvider {
  /** Stable id persisted on GoldPriceSnapshot.source. */
  id: string;
  name: string;
  fetchPrices(signal?: AbortSignal): Promise<GoldProviderResult>;
}

export type GoldSourceKind = "LIVE" | "SNAPSHOT" | "MANUAL";

export interface GoldSyncResult {
  prices: GoldPriceRecord[];
  pureGramBuyTL: number;
  pureGramSellTL: number;
  source: string;
  sourceKind: GoldSourceKind;
  fetchedAt: string;
  isCached: boolean;
  cacheExpiresInSeconds: number;
  /** True when the data did not come from a live provider on this cycle. */
  isStale: boolean;
  ageMinutes: number;
  /** Turkish warning to render in the UI, null when the data is fresh. */
  warning: string | null;
}

export class GoldPriceUnavailableError extends Error {
  constructor(message = "Altın fiyatları alınamadı ve kullanılabilir bir kayıt bulunamadı.") {
    super(message);
    this.name = "GoldPriceUnavailableError";
  }
}
