import Decimal from "decimal.js";
import { addMonths, lastDayOfMonth } from "date-fns";
import { AnnuityLoanParams, AmortizationRow, RateInput } from "./types";

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

/** Percent -> fraction. 3.89 becomes 0.0389. No magnitude guessing. */
export function percentToFraction(percent: RateInput): Decimal {
  return new Decimal(percent.toString()).dividedBy(100);
}

/** Fraction -> percent. 0.0389 becomes 3.89. */
export function fractionToPercent(fraction: RateInput): Decimal {
  return new Decimal(fraction.toString()).times(100);
}

function taxFraction(enabled: boolean | undefined, rate: RateInput | undefined, fallback: number) {
  if (enabled === false) return new Decimal(0);
  return new Decimal((rate ?? fallback).toString());
}

/**
 * Pins a due date to the requested day of month, clamping to the real last day
 * of that month so "30" does not silently become "28" in every month.
 */
export function applyPaymentDay(date: Date, paymentDayOfMonth?: number | null): Date {
  if (!paymentDayOfMonth || paymentDayOfMonth < 1 || paymentDayOfMonth > 31) return date;
  const result = new Date(date);
  const maxDay = lastDayOfMonth(result).getDate();
  result.setDate(Math.min(paymentDayOfMonth, maxDay));
  return result;
}

export interface AnnuityResult {
  installmentAmount: Decimal;
  /** Effective monthly rate as a fraction, taxes included. */
  effectiveMonthlyRate: Decimal;
  totalPayment: Decimal;
  totalInterest: Decimal;
}

/**
 * Monthly annuity instalment.
 *
 *   i_efektif = i * (1 + KKDF + BSMV)
 *   Taksit    = A * [i_ef * (1 + i_ef)^n] / [(1 + i_ef)^n - 1]
 */
export function calculateAnnuityInstallment(params: AnnuityLoanParams): AnnuityResult {
  const principal = new Decimal(params.principal.toString());
  const baseRate = percentToFraction(params.monthlyInterestRatePercent);
  const n = params.installmentCount;

  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("Taksit sayısı 0'dan büyük bir tam sayı olmalıdır.");
  }
  if (principal.isNegative()) {
    throw new Error("Anapara negatif olamaz.");
  }
  if (baseRate.isNegative()) {
    throw new Error("Faiz oranı negatif olamaz.");
  }

  const kkdf = taxFraction(params.includeKKDF, params.kkdfRate, 0.15);
  const bsmv = taxFraction(params.includeBSMV, params.bsmvRate, 0.15);
  const effectiveRate = baseRate.times(new Decimal(1).plus(kkdf).plus(bsmv));

  if (effectiveRate.isZero()) {
    const installment = principal.dividedBy(n);
    return {
      installmentAmount: installment.toDecimalPlaces(2),
      effectiveMonthlyRate: effectiveRate,
      totalPayment: principal.toDecimalPlaces(2),
      totalInterest: new Decimal(0),
    };
  }

  const onePlusIPowN = new Decimal(1).plus(effectiveRate).pow(n);
  const installment = principal.times(
    effectiveRate.times(onePlusIPowN).dividedBy(onePlusIPowN.minus(1))
  );
  const totalPayment = installment.times(n);

  return {
    installmentAmount: installment.toDecimalPlaces(2),
    effectiveMonthlyRate: effectiveRate,
    totalPayment: totalPayment.toDecimalPlaces(2),
    totalInterest: totalPayment.minus(principal).toDecimalPlaces(2),
  };
}

export interface AmortizationParams extends AnnuityLoanParams {
  /**
   * Due date of the FIRST instalment. Instalment n falls on
   * firstPaymentDate + (n-1) months, so the date the user typed is the date
   * that shows up on row 1 - both in the preview and in the saved plan.
   */
  firstPaymentDate?: Date | string | null;
  paymentDayOfMonth?: number | null;
  /** Optional override; when omitted the annuity instalment is used. */
  installmentAmountOverride?: RateInput | null;
}

/** Full amortisation table with principal / interest / KKDF / BSMV split. */
export function generateAmortizationSchedule(params: AmortizationParams): AmortizationRow[] {
  const principal = new Decimal(params.principal.toString());
  const baseRate = percentToFraction(params.monthlyInterestRatePercent);
  const n = params.installmentCount;

  const kkdf = taxFraction(params.includeKKDF, params.kkdfRate, 0.15);
  const bsmv = taxFraction(params.includeBSMV, params.bsmvRate, 0.15);

  const installmentAmount =
    params.installmentAmountOverride != null
      ? new Decimal(params.installmentAmountOverride.toString())
      : calculateAnnuityInstallment(params).installmentAmount;

  const firstDue = params.firstPaymentDate ? new Date(params.firstPaymentDate) : new Date();
  if (Number.isNaN(firstDue.getTime())) {
    throw new Error("İlk taksit tarihi geçersiz.");
  }

  const schedule: AmortizationRow[] = [];

  /*
   * The whole table is carried in kuruş (2 decimal places). Rounding each row
   * and then subtracting the ROUNDED amount from the balance is what makes the
   * principal column add up to the loan amount exactly - carrying a
   * full-precision balance while displaying rounded rows left a drift of a
   * kuruş or two by the last instalment (kabul kriteri 9).
   */
  let remainingPrincipal = principal.toDecimalPlaces(2);

  for (let i = 1; i <= n; i++) {
    const dueDate = applyPaymentDay(addMonths(firstDue, i - 1), params.paymentDayOfMonth);

    const rawInterest = remainingPrincipal.times(baseRate).toDecimalPlaces(2);
    const kkdfPart = rawInterest.times(kkdf).toDecimalPlaces(2);
    const bsmvPart = rawInterest.times(bsmv).toDecimalPlaces(2);
    const interestTotal = rawInterest.plus(kkdfPart).plus(bsmvPart);

    let principalPart = installmentAmount.minus(interestTotal).toDecimalPlaces(2);

    // The final row settles whatever is left, so the balance closes at zero.
    if (i === n || principalPart.greaterThan(remainingPrincipal)) {
      principalPart = remainingPrincipal;
    }
    if (principalPart.isNegative()) {
      principalPart = new Decimal(0);
    }

    remainingPrincipal = remainingPrincipal.minus(principalPart);
    if (remainingPrincipal.isNegative()) remainingPrincipal = new Decimal(0);

    schedule.push({
      installmentNo: i,
      dueDate,
      totalPayment: principalPart.plus(interestTotal),
      principalPayment: principalPart,
      interestPayment: rawInterest,
      kkdfPayment: kkdfPart,
      bsmvPayment: bsmvPart,
      remainingPrincipal,
    });
  }

  return schedule;
}

export interface SolvedRate {
  /** Contractual monthly rate as a PERCENT. */
  rawMonthlyRatePercent: Decimal;
  /** Tax inclusive monthly rate as a PERCENT. */
  effectiveMonthlyRatePercent: Decimal;
}

/**
 * Inverse solver: the user knows the instalment and the term, so bisect for the
 * monthly rate that reproduces it. Tax rates must be passed in because they
 * change the instalment for a given contractual rate.
 */
export function solveMonthlyInterestRate(
  principal: RateInput,
  installmentAmount: RateInput,
  installmentCount: number,
  includeKKDF = true,
  includeBSMV = true,
  kkdfRate: RateInput = 0.15,
  bsmvRate: RateInput = 0.15
): SolvedRate {
  const p = new Decimal(principal.toString());
  const target = new Decimal(installmentAmount.toString());
  const n = installmentCount;

  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("Taksit sayısı 0'dan büyük bir tam sayı olmalıdır.");
  }

  const kkdf = taxFraction(includeKKDF, kkdfRate, 0.15);
  const bsmv = taxFraction(includeBSMV, bsmvRate, 0.15);
  const taxMultiplier = new Decimal(1).plus(kkdf).plus(bsmv);

  // An instalment at or below principal/n implies a zero (or negative) rate.
  if (target.lessThanOrEqualTo(p.dividedBy(n))) {
    return {
      rawMonthlyRatePercent: new Decimal(0),
      effectiveMonthlyRatePercent: new Decimal(0),
    };
  }

  let low = new Decimal(0);
  let high = new Decimal(100); // %100 monthly upper bound
  let mid = low;

  for (let iter = 0; iter < 200; iter++) {
    mid = low.plus(high).dividedBy(2);
    const calculated = calculateAnnuityInstallment({
      principal: p,
      monthlyInterestRatePercent: mid,
      installmentCount: n,
      includeKKDF,
      kkdfRate: kkdf,
      includeBSMV,
      bsmvRate: bsmv,
    });

    if (calculated.installmentAmount.lessThan(target)) low = mid;
    else high = mid;

    if (high.minus(low).lessThan("0.0000001")) break;
  }

  return {
    rawMonthlyRatePercent: mid.toDecimalPlaces(4),
    effectiveMonthlyRatePercent: mid.times(taxMultiplier).toDecimalPlaces(4),
  };
}
