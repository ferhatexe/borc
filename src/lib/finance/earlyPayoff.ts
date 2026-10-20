import Decimal from "decimal.js";
import { AmortizationRow, RateInput } from "./types";

export interface EarlyPayoffParams {
  remainingPrincipal: RateInput;
  /**
   * Son taksitten bugüne işlemiş, henüz tahsil edilmemiş faiz. Banka kapamada
   * bunu da ister; her gün büyür.
   */
  accruedInterest?: RateInput;
  amortizationSchedule: AmortizationRow[];
  paidInstallmentCount: number;
  /**
   * Early payoff commission as a FRACTION of the remaining principal
   * (0.01 for %1). Comes from the `tax_rates` setting; defaults to zero since
   * the user's banks discount early payments instead of charging for them.
   */
  penaltyRate?: RateInput;
}

export interface EarlyPayoffResult {
  currentRemainingPrincipal: Decimal;
  /** Bugüne kadar işlemiş faiz (KKDF/BSMV dahil). */
  accruedInterest: Decimal;
  penaltyFee: Decimal;
  totalPayoffAmount: Decimal;
  remainingScheduledInterest: Decimal;
  /** Interest avoided minus the commission; never below zero. */
  totalInterestSaved: Decimal;
  remainingInstallmentCount: number;
  /** What the remaining instalments would cost if the loan simply ran its course. */
  remainingScheduledTotal: Decimal;
}

/**
 * "Şu an kapatırsam ne öderim, ne kazanırım?"
 * Remaining principal plus the commission, against the interest, KKDF and BSMV
 * that the remaining instalments would have carried.
 */
export function calculateEarlyPayoff(params: EarlyPayoffParams): EarlyPayoffResult {
  const remainingPrincipal = new Decimal(params.remainingPrincipal.toString());
  const accruedInterest = new Decimal((params.accruedInterest ?? 0).toString());
  const penaltyRate = new Decimal((params.penaltyRate ?? 0).toString());

  if (penaltyRate.isNegative()) throw new Error("Erken kapama komisyon oranı negatif olamaz.");

  const paid = Math.max(0, params.paidInstallmentCount);
  const remainingRows = params.amortizationSchedule.slice(paid);

  const remainingScheduledInterest = remainingRows.reduce(
    (sum, row) => sum.plus(row.interestPayment).plus(row.kkdfPayment).plus(row.bsmvPayment),
    new Decimal(0)
  );
  const remainingScheduledTotal = remainingRows.reduce(
    (sum, row) => sum.plus(row.totalPayment),
    new Decimal(0)
  );

  const penaltyFee = remainingPrincipal.times(penaltyRate);
  /*
   * Kazanç = kalan taksitlerin toplamı - bugünkü kapama tutarı.
   *
   * Plan güncelken bu, "kalan faiz - işlemiş faiz" ile aynı şey. Erken ödemeden
   * sonra ise banka satırların anapara/faiz dağılımını yeniden hesaplar ama
   * taksit tutarlarını korur; eski faiz paylarını toplamak kazancı yanlış
   * veriyordu (Garanti 24k, 20.10: 339,20 yerine gerçek kazanç 1.282,50).
   */
  const totalInterestSaved = remainingScheduledTotal
    .minus(remainingPrincipal)
    .minus(accruedInterest)
    .minus(penaltyFee);

  return {
    currentRemainingPrincipal: remainingPrincipal.toDecimalPlaces(2),
    accruedInterest: accruedInterest.toDecimalPlaces(2),
    penaltyFee: penaltyFee.toDecimalPlaces(2),
    totalPayoffAmount: remainingPrincipal
      .plus(accruedInterest)
      .plus(penaltyFee)
      .toDecimalPlaces(2),
    remainingScheduledInterest: remainingScheduledInterest.toDecimalPlaces(2),
    totalInterestSaved: totalInterestSaved.greaterThan(0)
      ? totalInterestSaved.toDecimalPlaces(2)
      : new Decimal(0),
    remainingInstallmentCount: remainingRows.length,
    remainingScheduledTotal: remainingScheduledTotal.toDecimalPlaces(2),
  };
}
