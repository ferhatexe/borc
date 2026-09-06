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
  /**
   * true  -> computed from the pure gram price via the millesimal table
   * false -> a real market quote for this exact product
   *
   * A real quote wins when valuing a debt: the şartname says to use "web'den
   * bulunan" price for 21 and 22 ayar, and a jeweller's quote carries its own
   * spread that the millesimal formula cannot reproduce.
   */
  isDerived: boolean;
  /** Which provider the quote came from, for the UI and for debugging. */
  source?: string;
}

/** One troy ounce in grams - used to derive the ONS price. */
export const GRAMS_PER_TROY_OUNCE = 31.1034768;

/** Currencies shown on the dashboard rate strip. */
export const TRACKED_CURRENCIES = ["USD", "EUR", "GBP", "CHF", "SAR", "AED"] as const;

export interface CurrencyRate {
  code: string;
  name: string;
  buyPrice: number;
  sellPrice: number;
  /** Daily change in percent, when the provider publishes one. */
  changePercent: number | null;
}

export interface GoldProviderResult {
  /** Gram "has altın" (pure) prices - the basis of every gram based calculation. */
  pureGramBuyTL: number;
  pureGramSellTL: number;
  /** Daily change of the pure gram price, in percent. */
  pureGramChangePercent: number | null;
  prices: GoldPriceRecord[];
  currencies: CurrencyRate[];
  /** Provider's own timestamp, when it publishes one. */
  providerUpdatedAt: string | null;
}

export interface GoldPriceProvider {
  /** Stable id persisted on GoldPriceSnapshot.source. */
  id: string;
  name: string;
  fetchPrices(signal?: AbortSignal): Promise<GoldProviderResult>;
}

export type GoldSourceKind = "LIVE" | "SNAPSHOT" | "MANUAL";

/** Gold per troy ounce in USD. */
export interface OunceQuote {
  usd: number;
  tryValue: number;
  /**
   * "QUOTED" means XAU/USD came straight from a market feed. "DERIVED" means
   * every ounce source failed and it was computed as
   * (gram has altın TL / USD-TRY) x 31.1035, which runs about %0,6 below the
   * real quote. The UI labels it so the number is never mistaken for a
   * primary market quote.
   */
  basis: "DERIVED" | "QUOTED";
  /** Hangi kaynaktan geldiği; QUOTED ise besleme adı. */
  source?: string;
}

export interface GoldSyncResult {
  prices: GoldPriceRecord[];
  pureGramBuyTL: number;
  pureGramSellTL: number;
  pureGramChangePercent: number | null;
  currencies: CurrencyRate[];
  /** null when there is no USD rate to derive it from. */
  ounce: OunceQuote | null;
  providerUpdatedAt: string | null;
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
