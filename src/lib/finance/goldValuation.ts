import Decimal from "decimal.js";
import { calculateGoldValueTL } from "./gold";
import { isPieceGoldType, type GoldPriceRecord } from "@/lib/gold/types";
import { DEFAULT_GOLD_MILLESIMAL } from "@/lib/settings/defaults";

/**
 * Altın borcunun TL karşılığı.
 *
 * Bu dosya bilerek prisma'dan bağımsızdır: aynı fonksiyon hem sunucuda
 * (dashboard, /api/live) hem de borç ekleme sihirbazının önizlemesinde
 * kullanılır. Form kendi hesabını yaptığı sürece önizleme ile kaydedilen
 * tutar birbirinden ayrışıyordu.
 */

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
