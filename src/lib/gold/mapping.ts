import { DEFAULT_GOLD_MILLESIMAL, DEFAULT_GOLD_UNIT_GRAMS } from "@/lib/settings/defaults";
import { GoldPriceRecord, GoldProviderResult } from "./types";

export interface RawQuote {
  buy: number;
  sell: number;
}

/** Accepts 1234.5, "1234.5" and Turkish formatted "1.234,50". */
export function parsePrice(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;

  const text = String(raw).trim();
  if (!text) return 0;

  // Turkish format uses "." for thousands and "," for decimals.
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Per-gram price of a karat, derived from the pure gram price. */
function derivePerGram(pure: RawQuote, karat: keyof typeof DEFAULT_GOLD_MILLESIMAL): RawQuote {
  const millesimal = DEFAULT_GOLD_MILLESIMAL[karat];
  return {
    buy: (pure.buy * millesimal) / 1000,
    sell: (pure.sell * millesimal) / 1000,
  };
}

export interface GoldQuoteSet {
  pure: RawQuote;
  gram?: RawQuote | null;
  ceyrek?: RawQuote | null;
  yarim?: RawQuote | null;
  tam?: RawQuote | null;
  ata?: RawQuote | null;
  gremse?: RawQuote | null;
  bilezik22?: RawQuote | null;
  bilezik18?: RawQuote | null;
  bilezik14?: RawQuote | null;
}

/**
 * Normalises a provider payload into the app's gold catalogue.
 *
 * Quotes the provider does not publish are DERIVED from the pure gram price
 * using the millesimal table - never replaced with an invented constant.
 * Margins (the +200 TL/gr for 21 ayar and so on) are user settings and are
 * applied later, in the conversion layer, not here.
 */
export function buildGoldRecords(q: GoldQuoteSet): GoldProviderResult {
  const pure = q.pure;
  const g = DEFAULT_GOLD_UNIT_GRAMS;

  const piece = (
    goldType: string,
    name: string,
    karat: number,
    quote: RawQuote | null | undefined,
    grams: number
  ): GoldPriceRecord | null => {
    // A piece price cannot be derived reliably (it carries its own premium),
    // so a missing quote drops the product rather than inventing a number.
    if (!quote) return null;
    return {
      goldType,
      name,
      karat,
      buyPrice: round2(quote.buy),
      sellPrice: round2(quote.sell),
      isPiece: true,
      effectiveGrams: grams,
    };
  };

  const gram = (
    goldType: string,
    name: string,
    karat: keyof typeof DEFAULT_GOLD_MILLESIMAL,
    quote?: RawQuote | null
  ): GoldPriceRecord => {
    const value = quote ?? derivePerGram(pure, karat);
    return {
      goldType,
      name,
      karat: Number(karat),
      buyPrice: round2(value.buy),
      sellPrice: round2(value.sell),
      isPiece: false,
      effectiveGrams: 1,
    };
  };

  const records: Array<GoldPriceRecord | null> = [
    gram("GRAM_ALTIN", "Gram Altın", "24", q.gram ?? pure),
    piece("CEYREK", "Çeyrek Altın", 22, q.ceyrek, g.CEYREK),
    piece("YARIM", "Yarım Altın", 22, q.yarim, g.YARIM),
    piece("TAM", "Tam Altın (Ziynet)", 22, q.tam, g.TAM),
    piece("ATA", "Ata Lira (Cumhuriyet)", 22, q.ata, g.ATA),
    piece("GREMSE", "Gremse Altın", 22, q.gremse, g.GREMSE),
    gram("BILEZIK_22", "22 Ayar Bilezik", "22", q.bilezik22),
    gram("ZINCIR_21_HALEP", "21 Ayar Halep Zinciri", "21"),
    gram("BILEZIK_18", "18 Ayar Altın", "18", q.bilezik18),
    gram("BILEZIK_14", "14 Ayar Altın", "14", q.bilezik14),
    gram("KULCE", "Külçe / Has Altın", "24", pure),
    gram("DIGER", "Diğer (Has Altın Bazlı)", "24", pure),
  ];

  return {
    pureGramBuyTL: round2(pure.buy),
    pureGramSellTL: round2(pure.sell),
    prices: records.filter((r): r is GoldPriceRecord => r !== null),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
