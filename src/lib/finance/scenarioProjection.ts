import Decimal from "decimal.js";
import { percentToFraction } from "./annuity";
import { RateInput } from "./types";

export interface LoanProjectionInput {
  id: string;
  title: string;
  remainingPrincipal: RateInput;
  monthlyPayment: RateInput;
  /** Monthly interest as a PERCENT, e.g. 3.5 for %3,5. */
  monthlyInterestRatePercent: RateInput;
  remainingMonths?: number;
}

export interface ScenarioParams {
  loans: LoanProjectionInput[];
  /** Extra principal paid every month. */
  monthlyExtraPayment?: number;
  /** One-off lump sum. */
  lumpSumAmount?: number;
  /** 1-indexed month the lump sum lands in. */
  lumpSumMonthIndex?: number;
  /** Simulation horizon in months. */
  maxMonths?: number;
}

export interface MonthTrajectoryPoint {
  monthIndex: number;
  monthLabel: string;
  baseRemainingPrincipal: number;
  acceleratedRemainingPrincipal: number;
  baseInterestPaidCumulative: number;
  acceleratedInterestPaidCumulative: number;
}

export interface ScenarioProjectionResult {
  baseMonthsToDebtFree: number;
  acceleratedMonthsToDebtFree: number;
  monthsSaved: number;
  baseTotalInterestPaid: number;
  acceleratedTotalInterestPaid: number;
  totalInterestSaved: number;
  /** True when a plan never clears inside the horizon (payment below interest). */
  baseNeverClears: boolean;
  acceleratedNeverClears: boolean;
  trajectory: MonthTrajectoryPoint[];
}

interface SimLoan {
  principal: Decimal;
  monthlyRate: Decimal;
  payment: Decimal;
}

function toSimLoans(loans: LoanProjectionInput[]): SimLoan[] {
  return loans.map((l) => ({
    principal: new Decimal(l.remainingPrincipal.toString()),
    monthlyRate: percentToFraction(l.monthlyInterestRatePercent),
    payment: new Decimal(l.monthlyPayment.toString()),
  }));
}

/** One month of the status-quo plan. Returns the interest accrued that month. */
function stepBase(loans: SimLoan[]): { interest: Decimal; remaining: Decimal } {
  let interest = new Decimal(0);
  let remaining = new Decimal(0);

  for (const loan of loans) {
    if (loan.principal.lessThanOrEqualTo(0)) continue;

    const monthInterest = loan.principal.times(loan.monthlyRate);
    interest = interest.plus(monthInterest);

    const principalPart = loan.payment.minus(monthInterest);
    loan.principal = principalPart.greaterThan(0)
      ? Decimal.max(0, loan.principal.minus(principalPart))
      : loan.principal.plus(principalPart.negated()); // payment below interest: balance grows

    remaining = remaining.plus(loan.principal);
  }

  return { interest, remaining };
}

/**
 * One month of the accelerated plan. Scheduled payments are applied first, then
 * the extra budget cascades down the avalanche order (highest rate first) so a
 * leftover after clearing one loan still works on the next.
 */
function stepAccelerated(
  loans: SimLoan[],
  extraBudget: Decimal
): { interest: Decimal; remaining: Decimal } {
  let interest = new Decimal(0);
  let extra = extraBudget;

  const active = loans
    .filter((l) => l.principal.greaterThan(0))
    .sort((a, b) => b.monthlyRate.comparedTo(a.monthlyRate));

  for (const loan of active) {
    const monthInterest = loan.principal.times(loan.monthlyRate);
    interest = interest.plus(monthInterest);

    const principalPart = loan.payment.minus(monthInterest);
    loan.principal = principalPart.greaterThan(0)
      ? Decimal.max(0, loan.principal.minus(principalPart))
      : loan.principal.plus(principalPart.negated());
  }

  for (const loan of active) {
    if (extra.lessThanOrEqualTo(0)) break;
    if (loan.principal.lessThanOrEqualTo(0)) continue;

    const applied = Decimal.min(extra, loan.principal);
    loan.principal = loan.principal.minus(applied);
    extra = extra.minus(applied);
  }

  const remaining = loans.reduce((sum, l) => sum.plus(Decimal.max(0, l.principal)), new Decimal(0));
  return { interest, remaining };
}

/**
 * Side-by-side simulation of the current plan and an accelerated one, month by
 * month, producing the debt-free date and the interest saved.
 */
export function calculateScenarioProjection(params: ScenarioParams): ScenarioProjectionResult {
  const maxMonths = params.maxMonths && params.maxMonths > 0 ? params.maxMonths : 60;
  const monthlyExtra = new Decimal(params.monthlyExtraPayment || 0);
  const lumpSum = new Decimal(params.lumpSumAmount || 0);
  const lumpSumMonth = params.lumpSumMonthIndex && params.lumpSumMonthIndex > 0
    ? params.lumpSumMonthIndex
    : 1;

  const baseLoans = toSimLoans(params.loans);
  const accelLoans = toSimLoans(params.loans);

  const trajectory: MonthTrajectoryPoint[] = [];
  let baseDebtFreeMonth = 0;
  let accelDebtFreeMonth = 0;
  let baseCumulativeInterest = new Decimal(0);
  let accelCumulativeInterest = new Decimal(0);

  const initialPrincipal = baseLoans.reduce((sum, l) => sum.plus(l.principal), new Decimal(0));
  trajectory.push({
    monthIndex: 0,
    monthLabel: "Bugün",
    baseRemainingPrincipal: initialPrincipal.toDecimalPlaces(0).toNumber(),
    acceleratedRemainingPrincipal: initialPrincipal.toDecimalPlaces(0).toNumber(),
    baseInterestPaidCumulative: 0,
    acceleratedInterestPaidCumulative: 0,
  });

  for (let m = 1; m <= maxMonths; m++) {
    const base = stepBase(baseLoans);
    baseCumulativeInterest = baseCumulativeInterest.plus(base.interest);
    if (base.remaining.lessThanOrEqualTo(0) && baseDebtFreeMonth === 0) baseDebtFreeMonth = m;

    let extra = monthlyExtra;
    if (m === lumpSumMonth) extra = extra.plus(lumpSum);

    const accel = stepAccelerated(accelLoans, extra);
    accelCumulativeInterest = accelCumulativeInterest.plus(accel.interest);
    if (accel.remaining.lessThanOrEqualTo(0) && accelDebtFreeMonth === 0) accelDebtFreeMonth = m;

    if (m <= 36 || m % 2 === 0 || base.remaining.lessThanOrEqualTo(0)) {
      trajectory.push({
        monthIndex: m,
        monthLabel: `${m}. Ay`,
        baseRemainingPrincipal: base.remaining.toDecimalPlaces(0).toNumber(),
        acceleratedRemainingPrincipal: accel.remaining.toDecimalPlaces(0).toNumber(),
        baseInterestPaidCumulative: baseCumulativeInterest.toDecimalPlaces(0).toNumber(),
        acceleratedInterestPaidCumulative: accelCumulativeInterest.toDecimalPlaces(0).toNumber(),
      });
    }

    if (base.remaining.lessThanOrEqualTo(0) && accel.remaining.lessThanOrEqualTo(0)) break;
  }

  const baseNeverClears = baseDebtFreeMonth === 0;
  const acceleratedNeverClears = accelDebtFreeMonth === 0;
  if (baseNeverClears) baseDebtFreeMonth = maxMonths;
  if (acceleratedNeverClears) accelDebtFreeMonth = maxMonths;

  return {
    baseMonthsToDebtFree: baseDebtFreeMonth,
    acceleratedMonthsToDebtFree: accelDebtFreeMonth,
    monthsSaved: Math.max(0, baseDebtFreeMonth - accelDebtFreeMonth),
    baseTotalInterestPaid: baseCumulativeInterest.toDecimalPlaces(2).toNumber(),
    acceleratedTotalInterestPaid: accelCumulativeInterest.toDecimalPlaces(2).toNumber(),
    totalInterestSaved: Decimal.max(0, baseCumulativeInterest.minus(accelCumulativeInterest))
      .toDecimalPlaces(2)
      .toNumber(),
    baseNeverClears,
    acceleratedNeverClears,
    trajectory,
  };
}
