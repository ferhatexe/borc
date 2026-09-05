import Decimal from "decimal.js";
import { AmortizationRow, RateInput } from "./types";

export interface EarlyPayoffParams {
  remainingPrincipal: RateInput;
  amortizationSchedule: AmortizationRow[];
  paidInstallmentCount: number;
  /**
   * Early payoff commission as a FRACTION of the remaining principal
   * (0.02 for %2). Comes from the `tax_rates` setting, never hardcoded.
   */
  penaltyRate?: RateInput;
}

export interface EarlyPayoffResult {
  currentRemainingPrincipal: Decimal;
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
  const penaltyRate = new Decimal((params.penaltyRate ?? 0.02).toString());

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
  const totalInterestSaved = remainingScheduledInterest.minus(penaltyFee);

  return {
    currentRemainingPrincipal: remainingPrincipal.toDecimalPlaces(2),
    penaltyFee: penaltyFee.toDecimalPlaces(2),
    totalPayoffAmount: remainingPrincipal.plus(penaltyFee).toDecimalPlaces(2),
    remainingScheduledInterest: remainingScheduledInterest.toDecimalPlaces(2),
    totalInterestSaved: totalInterestSaved.greaterThan(0)
      ? totalInterestSaved.toDecimalPlaces(2)
      : new Decimal(0),
    remainingInstallmentCount: remainingRows.length,
    remainingScheduledTotal: remainingScheduledTotal.toDecimalPlaces(2),
  };
}
