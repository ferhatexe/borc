import Decimal from "decimal.js";
import { GoldConversionParams } from "./types";
import { DEFAULT_GOLD_MILLESIMAL } from "@/lib/settings/defaults";
import { isPieceGoldType } from "@/lib/gold/types";

/** Karat implied by a product when the record does not carry one. */
const DEFAULT_KARAT_BY_TYPE: Record<string, number> = {
  GRAM_ALTIN: 24,
  KULCE: 24,
  CEYREK: 22,
  YARIM: 22,
  TAM: 22,
  ATA: 22,
  GREMSE: 22,
  BILEZIK_22: 22,
  ZINCIR_21_HALEP: 21,
  BILEZIK_18: 18,
  BILEZIK_14: 14,
  DIGER: 24,
};

export interface GoldValueResult {
  totalTL: Decimal;
  /** Piece products: price of one piece. Gram products: price of one gram. */
  unitPriceWithPremiumTL: Decimal;
  effectiveGrams: Decimal;
  /** Millesimal actually used, 0 for piece based products. */
  millesimalUsed: number;
}

/**
 * TL value of a gold holding, to the kuruş.
 *
 * Piece products (çeyrek / yarım / tam / ata / gremse):
 *   TL = Adet * (Birim Satış Fiyatı + premiumTL)
 *
 * Gram products (bilezik, zincir, külçe):
 *   TL = (Gram * Milyem * Has Altın Gram Satış) / 1000 + (Gram * premiumTL)
 *
 * `perGramPriceTL` short-circuits the millesimal step for a price that is
 * already expressed per gram of that karat (a manual entry, for example).
 */
export function calculateGoldValueTL(params: GoldConversionParams): GoldValueResult {
  const goldType = (params.goldType || "DIGER").toUpperCase();
  const isPiece = isPieceGoldType(goldType);
  const premium = new Decimal((params.premiumTL ?? 0).toString());

  if (isPiece) {
    const qty = new Decimal((params.quantity ?? 0).toString());
    const basePrice = new Decimal((params.unitPriceTL ?? 0).toString());
    const pricePerUnit = basePrice.plus(premium);

    return {
      totalTL: qty.times(pricePerUnit).toDecimalPlaces(2),
      unitPriceWithPremiumTL: pricePerUnit.toDecimalPlaces(2),
      effectiveGrams: new Decimal(0),
      millesimalUsed: 0,
    };
  }

  const grams = new Decimal((params.grams ?? 0).toString());
  const karat = params.karat ?? DEFAULT_KARAT_BY_TYPE[goldType] ?? 24;
  const millesimalMap = params.millesimalMap ?? DEFAULT_GOLD_MILLESIMAL;
  const millesimal = new Decimal(
    millesimalMap[String(karat)] ?? DEFAULT_GOLD_MILLESIMAL[String(karat)] ?? 1000
  );

  let baseValue: Decimal;
  if (params.perGramPriceTL != null) {
    baseValue = grams.times(new Decimal(params.perGramPriceTL.toString()));
  } else {
    const pureGoldPrice = new Decimal((params.pureGoldGramSellTL ?? 0).toString());
    baseValue = grams.times(millesimal).times(pureGoldPrice).dividedBy(1000);
  }

  const total = baseValue.plus(grams.times(premium));

  return {
    totalTL: total.toDecimalPlaces(2),
    unitPriceWithPremiumTL: grams.isZero()
      ? new Decimal(0)
      : total.dividedBy(grams).toDecimalPlaces(2),
    effectiveGrams: grams,
    millesimalUsed: millesimal.toNumber(),
  };
}

/** Karat a product defaults to, so forms can pre-fill and stay editable. */
export function defaultKaratForGoldType(goldType: string): number {
  return DEFAULT_KARAT_BY_TYPE[goldType?.toUpperCase()] ?? 22;
}
