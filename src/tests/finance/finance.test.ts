import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  applyPaymentDay,
  calculateAnnuityInstallment,
  generateAmortizationSchedule,
  percentToFraction,
  solveMonthlyInterestRate,
} from "@/lib/finance/annuity";
import { calculateGoldValueTL } from "@/lib/finance/gold";
import {
  calculateCreditCardOverdueInterest,
  calculateOverdraftInterest,
  daysSinceLastCharge,
} from "@/lib/finance/overdraft";
import { calculateEarlyPayoff } from "@/lib/finance/earlyPayoff";
import { calculateScenarioProjection } from "@/lib/finance/scenarioProjection";
import { DEFAULT_GOLD_MILLESIMAL } from "@/lib/settings/defaults";

const NO_TAX = { includeKKDF: false, includeBSMV: false } as const;

describe("Taksitli kredi (annüite)", () => {
  it("100.000 TL, aylık %3,5, 12 ay için doğru taksiti üretir", () => {
    const res = calculateAnnuityInstallment({
      principal: 100000,
      monthlyInterestRatePercent: 3.5,
      installmentCount: 12,
      ...NO_TAX,
    });

    // i=0.035, n=12 -> 100000 * 0.035*1.035^12 / (1.035^12 - 1)
    expect(res.installmentAmount.toNumber()).toBeCloseTo(10348.4, 1);
    expect(res.effectiveMonthlyRate.toNumber()).toBeCloseTo(0.035, 10);
    expect(res.totalPayment.minus(res.totalInterest).toNumber()).toBeCloseTo(100000, 0);
  });

  it("KKDF ve BSMV oranı efektif faizi i*(1+KKDF+BSMV) yapar", () => {
    const res = calculateAnnuityInstallment({
      principal: 100000,
      monthlyInterestRatePercent: 3,
      installmentCount: 24,
      includeKKDF: true,
      kkdfRate: 0.15,
      includeBSMV: true,
      bsmvRate: 0.15,
    });
    expect(res.effectiveMonthlyRate.toNumber()).toBeCloseTo(0.03 * 1.3, 10);
  });

  it("REGRESYON: %1'in altındaki oranlar 100 katına çıkarılmaz", () => {
    // Eski sezgisel normalizasyon 0.89'u %89 aylık faiz sanıyordu.
    const res = calculateAnnuityInstallment({
      principal: 1_000_000,
      monthlyInterestRatePercent: 0.89,
      installmentCount: 120,
      ...NO_TAX,
    });

    expect(res.effectiveMonthlyRate.toNumber()).toBeCloseTo(0.0089, 10);
    expect(res.installmentAmount.toNumber()).toBeLessThan(20000);
    expect(percentToFraction(0.89).toNumber()).toBeCloseTo(0.0089, 10);
  });

  it("faiz sıfırsa taksit anaparanın eşit bölümüdür", () => {
    const res = calculateAnnuityInstallment({
      principal: 12000,
      monthlyInterestRatePercent: 0,
      installmentCount: 12,
    });
    expect(res.installmentAmount.toNumber()).toBe(1000);
    expect(res.totalInterest.toNumber()).toBe(0);
  });

  it("geçersiz taksit sayısını reddeder", () => {
    expect(() =>
      calculateAnnuityInstallment({
        principal: 1000,
        monthlyInterestRatePercent: 3,
        installmentCount: 0,
      })
    ).toThrow();
  });
});

describe("İtfa tablosu", () => {
  const params = {
    principal: 100000,
    monthlyInterestRatePercent: 3.5,
    installmentCount: 12,
    ...NO_TAX,
    firstPaymentDate: new Date(2026, 8, 15),
  };

  it("anapara ödemeleri toplamı başlangıç anaparasına eşittir (kuruş kaybı yok)", () => {
    const rows = generateAmortizationSchedule(params);
    const total = rows.reduce((sum, r) => sum.plus(r.principalPayment), new Decimal(0));
    expect(total.toNumber()).toBeCloseTo(100000, 2);
    expect(rows[rows.length - 1].remainingPrincipal.toNumber()).toBe(0);
  });

  it("ilk taksit tam olarak firstPaymentDate tarihine düşer", () => {
    const rows = generateAmortizationSchedule(params);
    expect(rows[0].dueDate.getFullYear()).toBe(2026);
    expect(rows[0].dueDate.getMonth()).toBe(8); // Eylül
    expect(rows[0].dueDate.getDate()).toBe(15);
    // Sonraki taksitler birer ay arayla
    expect(rows[1].dueDate.getMonth()).toBe(9);
  });

  it("REGRESYON: ödeme günü 28'e kilitlenmez, ayın son gününe göre kırpılır", () => {
    const rows = generateAmortizationSchedule({
      ...params,
      installmentCount: 6,
      firstPaymentDate: new Date(2026, 0, 30), // 30 Ocak 2026
      paymentDayOfMonth: 30,
    });

    expect(rows[0].dueDate.getDate()).toBe(30); // Ocak
    expect(rows[1].dueDate.getDate()).toBe(28); // Şubat 2026 -> 28 gün
    expect(rows[2].dueDate.getDate()).toBe(30); // Mart
    expect(rows[3].dueDate.getDate()).toBe(30); // Nisan
  });

  it("applyPaymentDay ayın gün sayısını aşmaz", () => {
    expect(applyPaymentDay(new Date(2026, 1, 10), 31).getDate()).toBe(28);
    expect(applyPaymentDay(new Date(2024, 1, 10), 31).getDate()).toBe(29); // artık yıl
    expect(applyPaymentDay(new Date(2026, 3, 10), 31).getDate()).toBe(30);
  });

  it("faiz payı her satırda kalan anapara * oran olur", () => {
    const rows = generateAmortizationSchedule({ ...params, installmentCount: 3 });
    expect(rows[0].interestPayment.toNumber()).toBeCloseTo(100000 * 0.035, 2);
    const afterFirst = rows[0].remainingPrincipal;
    expect(rows[1].interestPayment.toNumber()).toBeCloseTo(afterFirst.toNumber() * 0.035, 2);
  });
});

describe("Ters faiz çözücü", () => {
  it("bilinen taksitten aylık oranı geri bulur", () => {
    const known = calculateAnnuityInstallment({
      principal: 100000,
      monthlyInterestRatePercent: 3.5,
      installmentCount: 12,
      ...NO_TAX,
    });

    const solved = solveMonthlyInterestRate(
      100000,
      known.installmentAmount,
      12,
      false,
      false
    );
    expect(solved.rawMonthlyRatePercent.toNumber()).toBeCloseTo(3.5, 2);
  });

  it("vergi oranları verildiğinde efektif oranı doğru raporlar", () => {
    const known = calculateAnnuityInstallment({
      principal: 50000,
      monthlyInterestRatePercent: 2.5,
      installmentCount: 24,
      includeKKDF: true,
      kkdfRate: 0.15,
      includeBSMV: true,
      bsmvRate: 0.15,
    });

    const solved = solveMonthlyInterestRate(
      50000,
      known.installmentAmount,
      24,
      true,
      true,
      0.15,
      0.15
    );
    expect(solved.rawMonthlyRatePercent.toNumber()).toBeCloseTo(2.5, 2);
    expect(solved.effectiveMonthlyRatePercent.toNumber()).toBeCloseTo(2.5 * 1.3, 2);
  });

  it("taksit anapara/n'e eşitse faizi sıfır kabul eder", () => {
    const solved = solveMonthlyInterestRate(12000, 1000, 12);
    expect(solved.rawMonthlyRatePercent.toNumber()).toBe(0);
  });
});

describe("Altın borcu TL dönüşümü", () => {
  const pureGramSell = 6864.36; // gram has altın satış

  it("çeyrek altın adet bazında hesaplanır", () => {
    const res = calculateGoldValueTL({
      goldType: "CEYREK",
      quantity: 4,
      unitPriceTL: 11165.67,
      premiumTL: 0,
    });
    expect(res.totalTL.toNumber()).toBeCloseTo(44662.68, 2);
  });

  it("adet bazlı üründe marj birim başına eklenir", () => {
    const res = calculateGoldValueTL({
      goldType: "TAM",
      quantity: 2,
      unitPriceTL: 44526.08,
      premiumTL: 500,
    });
    expect(res.totalTL.toNumber()).toBeCloseTo((44526.08 + 500) * 2, 2);
  });

  it("KABUL KRİTERİ 4: 21 ayar Halep zincirine gram başına +200 TL eklenir", () => {
    const grams = 100;
    const res = calculateGoldValueTL({
      goldType: "ZINCIR_21_HALEP",
      grams,
      karat: 21,
      pureGoldGramSellTL: pureGramSell,
      premiumTL: 200,
      millesimalMap: DEFAULT_GOLD_MILLESIMAL,
    });

    const expected = (grams * 875 * pureGramSell) / 1000 + grams * 200;
    expect(res.totalTL.toNumber()).toBeCloseTo(expected, 2);
    expect(res.millesimalUsed).toBe(875);

    // Marjsız hâlden tam olarak 100 x 200 TL fazla olmalı.
    const withoutPremium = calculateGoldValueTL({
      goldType: "ZINCIR_21_HALEP",
      grams,
      karat: 21,
      pureGoldGramSellTL: pureGramSell,
      premiumTL: 0,
    });
    expect(res.totalTL.minus(withoutPremium.totalTL).toNumber()).toBeCloseTo(20000, 2);
  });

  it("KABUL KRİTERİ 4: 22 ayar bilezikte marj uygulanmaz", () => {
    const grams = 50;
    const res = calculateGoldValueTL({
      goldType: "BILEZIK_22",
      grams,
      karat: 22,
      pureGoldGramSellTL: pureGramSell,
      premiumTL: 0,
    });
    expect(res.totalTL.toNumber()).toBeCloseTo((grams * 916 * pureGramSell) / 1000, 2);
  });

  it("KABUL KRİTERİ 5: yarım ve tam altın adet bazında hesaplanır", () => {
    const yarim = calculateGoldValueTL({
      goldType: "YARIM",
      quantity: 3,
      unitPriceTL: 22331.33,
    });
    const tam = calculateGoldValueTL({ goldType: "TAM", quantity: 1, unitPriceTL: 44526.08 });

    expect(yarim.totalTL.toNumber()).toBeCloseTo(66993.99, 2);
    expect(tam.totalTL.toNumber()).toBeCloseTo(44526.08, 2);
    expect(yarim.effectiveGrams.toNumber()).toBe(0); // adet bazlı, gram kullanılmaz
  });

  it("gram başına hazır fiyat verildiğinde milyem ikinci kez uygulanmaz", () => {
    const res = calculateGoldValueTL({
      goldType: "BILEZIK_22",
      grams: 10,
      karat: 22,
      perGramPriceTL: 6228.19,
      premiumTL: 0,
    });
    expect(res.totalTL.toNumber()).toBeCloseTo(62281.9, 2);
  });

  it("ayar verilmezse ürün türünden makul bir varsayılan seçer", () => {
    const res = calculateGoldValueTL({
      goldType: "BILEZIK_14",
      grams: 10,
      pureGoldGramSellTL: pureGramSell,
    });
    expect(res.millesimalUsed).toBe(585);
  });

  it("özel milyem tablosu kullanılabilir", () => {
    const res = calculateGoldValueTL({
      goldType: "ZINCIR_21_HALEP",
      grams: 1,
      karat: 21,
      pureGoldGramSellTL: 1000,
      millesimalMap: { "21": 900 },
      premiumTL: 0,
    });
    expect(res.totalTL.toNumber()).toBeCloseTo(900, 2);
  });
});

describe("KMH / ek hesap faizi", () => {
  it("10.000 TL, aylık %5, 15 gün için gün bazlı faizi hesaplar", () => {
    const res = calculateOverdraftInterest({
      usedAmount: 10000,
      monthlyInterestRatePercent: 5,
      days: 15,
      includeKKDF: true,
      kkdfRate: 0.15,
      includeBSMV: true,
      bsmvRate: 0.15,
    });

    const raw = (10000 * 0.05 * 15) / 30; // 250
    expect(res.interestAmount.toNumber()).toBeCloseTo(raw, 2);
    expect(res.kkdfAmount.toNumber()).toBeCloseTo(raw * 0.15, 2);
    expect(res.bsmvAmount.toNumber()).toBeCloseTo(raw * 0.15, 2);
    expect(res.totalAccruedInterest.toNumber()).toBeCloseTo(raw * 1.3, 2);
    expect(res.totalPayoffAmount.toNumber()).toBeCloseTo(10000 + raw * 1.3, 2);
  });

  it("günlük tahakkuk, 30 günlük tutarın otuzda biridir", () => {
    const res = calculateOverdraftInterest({
      usedAmount: 30000,
      monthlyInterestRatePercent: 4.5,
      days: 30,
    });
    expect(res.dailyAccrual.times(30).toNumber()).toBeCloseTo(
      res.totalAccruedInterest.toNumber(),
      2
    );
  });

  it("REGRESYON: %1'in altındaki oran 100 katına çıkarılmaz", () => {
    const res = calculateOverdraftInterest({
      usedAmount: 10000,
      monthlyInterestRatePercent: 0.5,
      days: 30,
      ...NO_TAX,
    });
    expect(res.interestAmount.toNumber()).toBeCloseTo(50, 2);
  });

  it("gün sayısı 0 ise faiz işlemez", () => {
    const res = calculateOverdraftInterest({
      usedAmount: 10000,
      monthlyInterestRatePercent: 5,
      days: 0,
    });
    expect(res.totalAccruedInterest.toNumber()).toBe(0);
  });

  it("daysSinceLastCharge geçmiş tarihten bugüne gün sayar, negatif dönmez", () => {
    const now = new Date(2026, 8, 20);
    expect(daysSinceLastCharge(new Date(2026, 8, 5), now)).toBe(15);
    expect(daysSinceLastCharge(new Date(2026, 9, 5), now)).toBe(0); // gelecek tarih
    expect(daysSinceLastCharge(null, now)).toBe(0);
  });
});

describe("Kredi kartı gecikme faizi", () => {
  it("akdi ve gecikme faizini ayrı ayrı gün bazında işletir", () => {
    const res = calculateCreditCardOverdueInterest({
      overdueBalance: 20000,
      contractualMonthlyRatePercent: 4.25,
      overdueMonthlyRatePercent: 4.75,
      daysOverdue: 10,
      includeKKDF: true,
      kkdfRate: 0.15,
      includeBSMV: true,
      bsmvRate: 0.15,
    });

    const contractual = (20000 * 0.0425 * 10) / 30;
    const overdue = (20000 * 0.0475 * 10) / 30;

    expect(res.contractualInterest.toNumber()).toBeCloseTo(contractual, 2);
    expect(res.overdueInterest.toNumber()).toBeCloseTo(overdue, 2);
    expect(res.totalInterest.toNumber()).toBeCloseTo((contractual + overdue) * 1.3, 2);
  });

  it("gecikme yoksa faiz doğmaz", () => {
    const res = calculateCreditCardOverdueInterest({
      overdueBalance: 20000,
      contractualMonthlyRatePercent: 4.25,
      overdueMonthlyRatePercent: 4.75,
      daysOverdue: 0,
    });
    expect(res.totalInterest.toNumber()).toBe(0);
    expect(res.totalPayoffAmount.toNumber()).toBe(20000);
  });
});

describe("Erken kapama simülatörü", () => {
  const schedule = generateAmortizationSchedule({
    principal: 100000,
    monthlyInterestRatePercent: 3.5,
    installmentCount: 12,
    ...NO_TAX,
    firstPaymentDate: new Date(2026, 0, 15),
  });

  it("komisyonu kalan anaparanın oranı olarak hesaplar", () => {
    const paid = 4;
    const remaining = schedule[paid].remainingPrincipal.plus(schedule[paid].principalPayment);

    const res = calculateEarlyPayoff({
      remainingPrincipal: remaining,
      amortizationSchedule: schedule,
      paidInstallmentCount: paid,
      penaltyRate: 0.02,
    });

    expect(res.penaltyFee.toNumber()).toBeCloseTo(remaining.toNumber() * 0.02, 2);
    expect(res.totalPayoffAmount.toNumber()).toBeCloseTo(
      remaining.plus(res.penaltyFee).toNumber(),
      2
    );
    expect(res.remainingInstallmentCount).toBe(12 - paid);
  });

  it("faiz tasarrufu kalan faizden komisyonu düşer ve negatife inmez", () => {
    const res = calculateEarlyPayoff({
      remainingPrincipal: 1000,
      amortizationSchedule: schedule,
      paidInstallmentCount: 11, // neredeyse bitmiş
      penaltyRate: 0.5, // aşırı yüksek komisyon
    });
    expect(res.totalInterestSaved.toNumber()).toBe(0);
  });

  it("negatif komisyon oranını reddeder", () => {
    expect(() =>
      calculateEarlyPayoff({
        remainingPrincipal: 1000,
        amortizationSchedule: schedule,
        paidInstallmentCount: 0,
        penaltyRate: -0.1,
      })
    ).toThrow();
  });
});

describe("Çoklu kredi senaryo simülatörü", () => {
  const loans = [
    {
      id: "a",
      title: "QNB İhtiyaç",
      remainingPrincipal: 60000,
      monthlyPayment: 6000,
      monthlyInterestRatePercent: 3.5,
    },
    {
      id: "b",
      title: "Ziraat Taşıt",
      remainingPrincipal: 40000,
      monthlyPayment: 4000,
      monthlyInterestRatePercent: 2.5,
    },
  ];

  it("aylık ek ödeme borcu erken bitirir ve faiz tasarrufu sağlar", () => {
    const res = calculateScenarioProjection({ loans, monthlyExtraPayment: 3000 });

    expect(res.acceleratedMonthsToDebtFree).toBeLessThan(res.baseMonthsToDebtFree);
    expect(res.monthsSaved).toBeGreaterThan(0);
    expect(res.totalInterestSaved).toBeGreaterThan(0);
    expect(res.baseNeverClears).toBe(false);
  });

  it("toplu ödeme anaparayı azaltır", () => {
    const res = calculateScenarioProjection({
      loans,
      lumpSumAmount: 25000,
      lumpSumMonthIndex: 2,
    });
    expect(res.acceleratedTotalInterestPaid).toBeLessThan(res.baseTotalInterestPaid);
  });

  it("ek ödeme yoksa iki senaryo birebir aynıdır", () => {
    const res = calculateScenarioProjection({ loans });
    expect(res.monthsSaved).toBe(0);
    expect(res.totalInterestSaved).toBeCloseTo(0, 2);
  });

  it("taksit faizi karşılamıyorsa borcun kapanmadığını bildirir", () => {
    const res = calculateScenarioProjection({
      loans: [
        {
          id: "x",
          title: "Asgari ödenen kart",
          remainingPrincipal: 50000,
          monthlyPayment: 100, // faizin çok altında
          monthlyInterestRatePercent: 4,
        },
      ],
      maxMonths: 24,
    });
    expect(res.baseNeverClears).toBe(true);
    expect(res.trajectory.at(-1)!.baseRemainingPrincipal).toBeGreaterThan(50000);
  });

  it("oranlar yüzde olarak yorumlanır", () => {
    const res = calculateScenarioProjection({
      loans: [
        {
          id: "y",
          title: "Faizsiz",
          remainingPrincipal: 12000,
          monthlyPayment: 1000,
          monthlyInterestRatePercent: 0,
        },
      ],
    });
    expect(res.baseMonthsToDebtFree).toBe(12);
    expect(res.baseTotalInterestPaid).toBe(0);
  });
});
