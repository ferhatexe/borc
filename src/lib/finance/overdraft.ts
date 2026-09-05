import Decimal from "decimal.js";
import { differenceInCalendarDays } from "date-fns";
import { CreditCardInterestParams, OverdraftInterestParams, RateInput } from "./types";
import { percentToFraction } from "./annuity";

/** Turkish banking convention: monthly interest is spread over a 30 day month. */
const DAYS_IN_MONTH = 30;

function taxFraction(enabled: boolean | undefined, rate: RateInput | undefined, fallback: number) {
  if (enabled === false) return new Decimal(0);
  return new Decimal((rate ?? fallback).toString());
}

export interface OverdraftInterestResult {
  interestAmount: Decimal;
  kkdfAmount: Decimal;
  bsmvAmount: Decimal;
  totalAccruedInterest: Decimal;
  totalPayoffAmount: Decimal;
  /** Accrual for a single day, used by the live dashboard counter. */
  dailyAccrual: Decimal;
}

/**
 * KMH / ek hesap accrued interest.
 *
 *   Faiz  = (Kullanılan Bakiye * i_aylık * Gün) / 30
 *   Toplam = Faiz + KKDF + BSMV
 */
export function calculateOverdraftInterest(
  params: OverdraftInterestParams
): OverdraftInterestResult {
  const usedAmount = new Decimal(params.usedAmount.toString());
  const rate = percentToFraction(params.monthlyInterestRatePercent);
  const days = new Decimal(Math.max(0, params.days));

  if (rate.isNegative()) throw new Error("Faiz oranı negatif olamaz.");

  const kkdfRate = taxFraction(params.includeKKDF, params.kkdfRate, 0.15);
  const bsmvRate = taxFraction(params.includeBSMV, params.bsmvRate, 0.15);

  const perDay = usedAmount.times(rate).dividedBy(DAYS_IN_MONTH);
  const rawInterest = perDay.times(days);

  const kkdf = rawInterest.times(kkdfRate);
  const bsmv = rawInterest.times(bsmvRate);
  const totalAccrued = rawInterest.plus(kkdf).plus(bsmv);

  const taxMultiplier = new Decimal(1).plus(kkdfRate).plus(bsmvRate);

  return {
    interestAmount: rawInterest.toDecimalPlaces(2),
    kkdfAmount: kkdf.toDecimalPlaces(2),
    bsmvAmount: bsmv.toDecimalPlaces(2),
    totalAccruedInterest: totalAccrued.toDecimalPlaces(2),
    totalPayoffAmount: usedAmount.plus(totalAccrued).toDecimalPlaces(2),
    // Kept at full precision: the live ticker divides it down to seconds.
    dailyAccrual: perDay.times(taxMultiplier),
  };
}

/** Whole days between the last interest charge and now, never negative. */
export function daysSinceLastCharge(
  lastInterestChargeDate?: Date | string | null,
  now: Date = new Date()
): number {
  if (!lastInterestChargeDate) return 0;
  const from = new Date(lastInterestChargeDate);
  if (Number.isNaN(from.getTime())) return 0;
  return Math.max(0, differenceInCalendarDays(now, from));
}

export interface CreditCardInterestResult {
  contractualInterest: Decimal;
  overdueInterest: Decimal;
  kkdfAmount: Decimal;
  bsmvAmount: Decimal;
  totalInterest: Decimal;
  totalPayoffAmount: Decimal;
}

/**
 * Credit card interest on a balance carried past the due date. Contractual
 * (akdi) and overdue (gecikme) interest are accrued separately on a daily
 * basis, then KKDF and BSMV are applied on top (şartname §4.3).
 */
export function calculateCreditCardOverdueInterest(
  params: CreditCardInterestParams
): CreditCardInterestResult {
  const balance = new Decimal(params.overdueBalance.toString());
  const days = new Decimal(Math.max(0, params.daysOverdue));

  const contractualRate = percentToFraction(params.contractualMonthlyRatePercent);
  const overdueRate = percentToFraction(params.overdueMonthlyRatePercent);

  const kkdfRate = taxFraction(params.includeKKDF, params.kkdfRate, 0.15);
  const bsmvRate = taxFraction(params.includeBSMV, params.bsmvRate, 0.15);

  const contractual = balance.times(contractualRate).times(days).dividedBy(DAYS_IN_MONTH);
  const overdue = balance.times(overdueRate).times(days).dividedBy(DAYS_IN_MONTH);
  const base = contractual.plus(overdue);

  const kkdf = base.times(kkdfRate);
  const bsmv = base.times(bsmvRate);
  const total = base.plus(kkdf).plus(bsmv);

  return {
    contractualInterest: contractual.toDecimalPlaces(2),
    overdueInterest: overdue.toDecimalPlaces(2),
    kkdfAmount: kkdf.toDecimalPlaces(2),
    bsmvAmount: bsmv.toDecimalPlaces(2),
    totalInterest: total.toDecimalPlaces(2),
    totalPayoffAmount: balance.plus(total).toDecimalPlaces(2),
  };
}
