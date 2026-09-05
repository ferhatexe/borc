import Decimal from "decimal.js";

/**
 * RATE CONVENTIONS - these are enforced across the whole finance engine and
 * must never be guessed at from the magnitude of the number.
 *
 *   *RatePercent  -> a percentage,  3.89 means %3,89 per month
 *   kkdfRate / bsmvRate / penalty rates -> a fraction, 0.15 means %15
 *
 * The old heuristic ("divide by 100 when the value is above 1") silently turned
 * a %0,89 subsidised housing loan into %89 per month, so it is gone for good.
 */
export type RateInput = number | string | Decimal;

export interface AnnuityLoanParams {
  principal: RateInput;
  /** Monthly contractual interest as a PERCENT, e.g. 3.89 for %3,89. */
  monthlyInterestRatePercent: RateInput;
  installmentCount: number;
  includeKKDF?: boolean;
  /** Fraction of the interest amount, e.g. 0.15 for %15. */
  kkdfRate?: RateInput;
  includeBSMV?: boolean;
  /** Fraction of the interest amount, e.g. 0.15 for %15. */
  bsmvRate?: RateInput;
}

export interface AmortizationRow {
  installmentNo: number;
  dueDate: Date;
  totalPayment: Decimal;
  principalPayment: Decimal;
  interestPayment: Decimal;
  kkdfPayment: Decimal;
  bsmvPayment: Decimal;
  remainingPrincipal: Decimal;
}

export interface GoldConversionParams {
  goldType: string;
  /** Piece count for çeyrek / yarım / tam / ata / gremse. */
  quantity?: RateInput;
  /** Weight in grams for bilezik / zincir / külçe. */
  grams?: RateInput;
  /** 14 | 18 | 21 | 22 | 24 */
  karat?: number | null;
  /** Selling price of one piece (piece based products). */
  unitPriceTL?: RateInput;
  /** Gram "has altın" selling price (gram based products). */
  pureGoldGramSellTL?: RateInput;
  /**
   * A ready per-gram price that already accounts for the karat. When present it
   * replaces the millesimal calculation, so a manually entered per-gram price is
   * not scaled twice.
   */
  perGramPriceTL?: RateInput;
  /** User margin in TL, per piece or per gram. */
  premiumTL?: RateInput;
  millesimalMap?: Record<string, number>;
}

export interface OverdraftInterestParams {
  usedAmount: RateInput;
  /** Monthly interest as a PERCENT, e.g. 4.5 for %4,5. */
  monthlyInterestRatePercent: RateInput;
  days: number;
  includeKKDF?: boolean;
  kkdfRate?: RateInput;
  includeBSMV?: boolean;
  bsmvRate?: RateInput;
}

export interface CreditCardInterestParams {
  /** Balance carried past the due date. */
  overdueBalance: RateInput;
  /** Monthly contractual (akdi) interest as a PERCENT. */
  contractualMonthlyRatePercent: RateInput;
  /** Monthly overdue (gecikme) interest as a PERCENT. */
  overdueMonthlyRatePercent: RateInput;
  /** Days past the due date. */
  daysOverdue: number;
  includeKKDF?: boolean;
  kkdfRate?: RateInput;
  includeBSMV?: boolean;
  bsmvRate?: RateInput;
}
