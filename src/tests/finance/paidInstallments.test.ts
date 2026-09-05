import { describe, it, expect } from "vitest";
import { generateAmortizationSchedule } from "@/lib/finance/annuity";
import { calculateEarlyPayoff } from "@/lib/finance/earlyPayoff";
import { valuateDebt } from "@/lib/finance/debtValuation";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { DebtWithRelations } from "@/lib/db/debts";

/**
 * Krediyi ortasından ekleme senaryosu.
 *
 * Gerçek şikâyet: 5 taksitli 40.000 TL kredinin 1 taksiti ödenmişti.
 * "Kaç taksit ödendi" alanı olmadığı için kullanıcı kalan 4 taksiti girdi;
 * anapara 40.000 kaldığından erken kapama 40.800 TL çıkıyordu, oysa banka
 * 32.195,95 diyordu. Ayrıca 4 x taksit < anapara olduğu için faiz %0 çözülüyordu.
 */

const PLAN = generateAmortizationSchedule({
  principal: 40000,
  monthlyInterestRatePercent: 3.3,
  installmentCount: 5,
  installmentAmountOverride: 9598.57,
  includeKKDF: false,
  includeBSMV: false,
  firstPaymentDate: new Date(2026, 7, 2),
  paymentDayOfMonth: 2,
});

function loanWith(paidCount: number): DebtWithRelations {
  return {
    id: "d", userId: "u", type: "TAKSITLI_KREDI", title: "QNB",
    status: "AKTIF", currency: "TRY", institutionId: null, institution: null,
    startDate: new Date(2026, 6, 2), createdAt: new Date(), updatedAt: new Date(),
    isArchived: false, tags: [], notes: null, color: null, description: null,
    principal: 40000, interestRateMonthly: 3.3, installmentCount: 5,
    installmentAmount: 9598.57, paymentDayOfMonth: 2, paidInstallments: paidCount,
    includeKKDF: false, includeBSMV: false, kkdfRate: null, bsmvRate: null,
    payments: [],
    installmentSchedules: PLAN.map((r, i) => ({
      id: `s${i}`, debtId: "d", installmentNo: r.installmentNo, dueDate: r.dueDate,
      totalAmount: r.totalPayment, principalPart: r.principalPayment,
      interestPart: r.interestPayment.plus(r.kkdfPayment).plus(r.bsmvPayment),
      remainingPrincipal: r.remainingPrincipal,
      status: i < paidCount ? "ODENDI" : "BEKLIYOR",
      paidAt: i < paidCount ? r.dueDate : null,
      paidAmount: i < paidCount ? r.totalPayment : null,
    })),
  } as unknown as DebtWithRelations;
}

describe("Ortasından eklenen kredi", () => {
  it("hiç ödeme yoksa kalan anapara tam anaparadır", () => {
    const v = valuateDebt(loanWith(0), null, DEFAULT_SETTINGS, new Date(2026, 7, 1));
    expect(v.principalTL).toBeCloseTo(40000, 2);
    expect(v.remainingInstallments).toBe(5);
  });

  it("REGRESYON: 1 taksit ödenince kalan anapara 40.000'in altına iner", () => {
    const v = valuateDebt(loanWith(1), null, DEFAULT_SETTINGS, new Date(2026, 8, 1));
    expect(v.principalTL).toBeLessThan(40000);
    expect(v.principalTL).toBeGreaterThan(30000);
    expect(v.remainingInstallments).toBe(4);
    expect(v.paidInstallments).toBe(1);
  });

  it("REGRESYON: kalan anapara, ödenen taksitin anapara payı kadar azalır", () => {
    const yok = valuateDebt(loanWith(0), null, DEFAULT_SETTINGS, new Date(2026, 7, 1));
    const bir = valuateDebt(loanWith(1), null, DEFAULT_SETTINGS, new Date(2026, 8, 1));
    expect(yok.principalTL - bir.principalTL).toBeCloseTo(
      PLAN[0].principalPayment.toNumber(),
      2
    );
  });

  it("REGRESYON: erken kapama kalan anaparaya dayanır, ilk anaparaya değil", () => {
    const v = valuateDebt(loanWith(1), null, DEFAULT_SETTINGS, new Date(2026, 8, 1));
    const payoff = calculateEarlyPayoff({
      remainingPrincipal: v.principalTL,
      amortizationSchedule: PLAN,
      paidInstallmentCount: 1,
      penaltyRate: 0.02,
    });

    // Hatali surumde 40.000 x 1,02 = 40.800 cikiyordu.
    expect(payoff.currentRemainingPrincipal.toNumber()).toBeCloseTo(v.principalTL, 2);
    expect(payoff.totalPayoffAmount.toNumber()).toBeLessThan(40000);
    expect(payoff.totalPayoffAmount.toNumber()).toBeCloseTo(
      v.principalTL + payoff.penaltyFee.toNumber(),
      2
    );
  });

  it("erken kapamada yalnızca kalan taksitlerin faizi iptal olur", () => {
    const payoff = calculateEarlyPayoff({
      remainingPrincipal: 32117.43,
      amortizationSchedule: PLAN,
      paidInstallmentCount: 1,
      penaltyRate: 0.02,
    });
    const kalanFaiz = PLAN.slice(1).reduce((s, r) => s + r.interestPayment.toNumber(), 0);
    expect(payoff.remainingScheduledInterest.toNumber()).toBeCloseTo(kalanFaiz, 2);
    expect(payoff.remainingInstallmentCount).toBe(4);
  });

  it("ödenmiş taksitler gecikmiş sayılmaz", () => {
    // Tum vadeler gecmiste; odenmis olan gecikme listesine girmemeli.
    const v = valuateDebt(loanWith(5), null, DEFAULT_SETTINGS, new Date(2027, 0, 1));
    expect(v.isOverdue).toBe(false);
    expect(v.outstandingTL).toBe(0);
    expect(v.remainingInstallments).toBe(0);
  });
});
