/**
 * Single source of truth for every configurable rate, margin and table.
 * Seed writes these into the Setting table; the app always READS from the
 * Setting table and only falls back here when a key is missing.
 * Nothing in the app may hardcode a rate that appears in this file.
 */

export const SETTING_KEYS = {
  TAX_RATES: "tax_rates",
  GOLD_MARGINS: "gold_margins",
  GOLD_KARAT_MILLESIMAL: "gold_karat_millesimal",
  GOLD_UNIT_GRAMS: "gold_unit_grams",
  GOLD_MANUAL_PRICES: "gold_manual_prices",
  APP_PREFERENCES: "app_preferences",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export interface TaxRates {
  /** KKDF - Kaynak Kullanımını Destekleme Fonu (share of the interest amount) */
  kkdfRate: number;
  /** BSMV - Banka ve Sigorta Muameleleri Vergisi (share of the interest amount) */
  bsmvRate: number;
  /** Early payoff commission, share of the remaining principal */
  earlyPayoffPenaltyRate: number;
  /** Credit card minimum payment, share of the statement balance */
  creditCardMinPaymentRate: number;
}

/** Extra TL the user pays per unit (piece) or per gram (gram based products). */
export type GoldMargins = Record<string, number>;

/** Karat -> millesimal fineness (parts per thousand). */
export type GoldMillesimal = Record<string, number>;

/** Gold product -> weight of one piece in grams. */
export type GoldUnitGrams = Record<string, number>;

export interface GoldManualPrices {
  /** When true the manual prices win over every live provider. */
  enabled: boolean;
  /** Gram "has altın" (pure) selling price, the basis of every gram calculation. */
  pureGramSellTL: number;
  /** Per-product unit selling price for piece based products. */
  prices: Record<string, number>;
  updatedAt: string | null;
}

export interface AppPreferences {
  currency: "TRY" | "USD" | "EUR";
  theme: "dark" | "light";
  locale: string;
}

export const DEFAULT_TAX_RATES: TaxRates = {
  kkdfRate: 0.15,
  bsmvRate: 0.15,
  // Sıfır: kullanıcının bankaları erken ödemede ceza değil indirim uyguluyor.
  // Komisyon alan bir banka varsa oran Ayarlar'dan girilir.
  earlyPayoffPenaltyRate: 0,
  creditCardMinPaymentRate: 0.2,
};

export const DEFAULT_GOLD_MARGINS: GoldMargins = {
  GRAM_ALTIN: 0,
  CEYREK: 0,
  YARIM: 0,
  TAM: 0,
  ATA: 0,
  GREMSE: 0,
  BILEZIK_22: 0, // 22 ayar bilezik: piyasa fiyatı aynen, marj yok
  ZINCIR_21_HALEP: 200, // 21 ayar (Halep zinciri dahil): gram başına +200 TL
  BILEZIK_14: 0,
  BILEZIK_18: 0,
  KULCE: 0,
  DIGER: 0,
};

export const DEFAULT_GOLD_MILLESIMAL: GoldMillesimal = {
  "14": 585,
  "18": 750,
  "21": 875,
  "22": 916,
  "24": 995,
};

export const DEFAULT_GOLD_UNIT_GRAMS: GoldUnitGrams = {
  GRAM_ALTIN: 1.0,
  CEYREK: 1.75,
  YARIM: 3.5,
  TAM: 7.0,
  ATA: 7.216,
  GREMSE: 17.5,
};

export const DEFAULT_GOLD_MANUAL_PRICES: GoldManualPrices = {
  enabled: false,
  pureGramSellTL: 0,
  prices: {},
  updatedAt: null,
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  currency: "TRY",
  theme: "dark",
  locale: "tr-TR",
};

export interface AppSettings {
  taxRates: TaxRates;
  goldMargins: GoldMargins;
  goldMillesimal: GoldMillesimal;
  goldUnitGrams: GoldUnitGrams;
  goldManualPrices: GoldManualPrices;
  appPreferences: AppPreferences;
}

export const DEFAULT_SETTINGS: AppSettings = {
  taxRates: DEFAULT_TAX_RATES,
  goldMargins: DEFAULT_GOLD_MARGINS,
  goldMillesimal: DEFAULT_GOLD_MILLESIMAL,
  goldUnitGrams: DEFAULT_GOLD_UNIT_GRAMS,
  goldManualPrices: DEFAULT_GOLD_MANUAL_PRICES,
  appPreferences: DEFAULT_APP_PREFERENCES,
};

/** Key -> default value, used by the seed script and by the settings reader. */
export const DEFAULT_SETTING_VALUES: Record<SettingKey, unknown> = {
  [SETTING_KEYS.TAX_RATES]: DEFAULT_TAX_RATES,
  [SETTING_KEYS.GOLD_MARGINS]: DEFAULT_GOLD_MARGINS,
  [SETTING_KEYS.GOLD_KARAT_MILLESIMAL]: DEFAULT_GOLD_MILLESIMAL,
  [SETTING_KEYS.GOLD_UNIT_GRAMS]: DEFAULT_GOLD_UNIT_GRAMS,
  [SETTING_KEYS.GOLD_MANUAL_PRICES]: DEFAULT_GOLD_MANUAL_PRICES,
  [SETTING_KEYS.APP_PREFERENCES]: DEFAULT_APP_PREFERENCES,
};
