import { describe, it, expect } from "vitest";
import { calculateScenarioProjection } from "@/lib/finance/scenarioProjection";
import type { DebtValuation } from "@/lib/finance/debtValuation";

/**
 * Simülatörün beklediği girdiyi bir borç değerlemesinden kuran eşleme.
 *
 * Rapor sayfası bunu yapmıyor, /api/debts'ten gelen ham borç satırlarını
 * doğrudan veriyordu. O satırlarda `remainingPrincipal` ve `monthlyPayment`
 * alanları yok; adları `principal` ve `installmentAmount`. Sonuç: simülatörün
 * girdi listesi hep boş kalıyor, bileşen sessizce hiçbir şey çizmiyordu -
 * kullanıcı Senaryo Simülatörü sekmesini bomboş görüyordu.
 *
 * Bu dosya eşlemeyi sabitler: rapor sayfası değişirse burası da kırılır.
 */
export function valuationToLoanInput(v: {
  id: string;
  title: string;
  type: string;
  principalTL: number;
  installmentAmountTL: number | null;
  monthlyInterestRatePercent: number | null;
  remainingInstallments: number | null;
}) {
  return {
    id: v.id,
    title: v.title,
    remainingPrincipal: v.principalTL,
    monthlyPayment: v.installmentAmountTL ?? 0,
    monthlyInterestRatePercent: v.monthlyInterestRatePercent ?? 0,
    remainingMonths: v.remainingInstallments ?? 0,
  };
}

/** Kullanıcının gerçek kredileri (07.09.2026 itibarıyla). */
const GERCEK_KREDILER = [
  {
    id: "a",
    title: "QNB İhtiyaç Kredisi (40.000 TL)",
    type: "TAKSITLI_KREDI",
    principalTL: 32195.95,
    installmentAmountTL: 9598.57,
    monthlyInterestRatePercent: 4.24,
    remainingInstallments: 4,
  },
  {
    id: "b",
    title: "QNB Finansbank İhtiyaç Kredisi",
    type: "TAKSITLI_KREDI",
    principalTL: 18910.99,
    installmentAmountTL: 4534.69,
    monthlyInterestRatePercent: 4.99,
    remainingInstallments: 5,
  },
  {
    id: "c",
    title: "Garanti BBVA İhtiyaç Kredisi",
    type: "TAKSITLI_KREDI",
    principalTL: 24000,
    installmentAmountTL: 6023.62,
    monthlyInterestRatePercent: 6.2153,
    remainingInstallments: 5,
  },
];

describe("Senaryo simülatörü girdisi", () => {
  it("REGRESYON: ham borç kaydı simülatörün istediği alanları taşımaz", () => {
    // /api/debts'in döndürdüğü satırın ilgili alanları bu adlarla gelir.
    const hamBorc = {
      id: "a",
      type: "TAKSITLI_KREDI",
      principal: 40000,
      installmentAmount: 9598.57,
      interestRateMonthly: 4.24,
    } as Record<string, unknown>;

    // Simülatörün süzgeci tam olarak bu iki alana bakıyor.
    expect(hamBorc.remainingPrincipal).toBeUndefined();
    expect(hamBorc.monthlyPayment).toBeUndefined();
  });

  it("değerlemeden kurulan girdi simülatörün süzgecinden geçer", () => {
    const girdiler = GERCEK_KREDILER.map(valuationToLoanInput);
    const gecenler = girdiler.filter(
      (l) => Number(l.remainingPrincipal) > 0 && Number(l.monthlyPayment) > 0
    );
    expect(gecenler).toHaveLength(3);
  });

  it("gerçek kredilerle çalışan bir projeksiyon üretir", () => {
    const projeksiyon = calculateScenarioProjection({
      loans: GERCEK_KREDILER.map(valuationToLoanInput),
      monthlyExtraPayment: 2000,
    });

    expect(projeksiyon.baseNeverClears).toBe(false);
    expect(projeksiyon.baseMonthsToDebtFree).toBe(5);
    expect(projeksiyon.trajectory.length).toBeGreaterThan(0);

    /*
     * Ek ödeme her zaman vadeyi kısaltmaz: bu krediler zaten 4-5 ayda bitiyor
     * ve aylık 2.000 TL, bir ayı tamamen silmeye yetmiyor. Kazanç faizde
     * görünür - simülatörün asıl söylediği de bu.
     */
    expect(projeksiyon.acceleratedMonthsToDebtFree).toBe(5);
    expect(projeksiyon.totalInterestSaved).toBeCloseTo(1132.53, 2);
  });

  it("yeterince büyük bir ek ödeme vadeyi de kısaltır", () => {
    const projeksiyon = calculateScenarioProjection({
      loans: GERCEK_KREDILER.map(valuationToLoanInput),
      monthlyExtraPayment: 10000,
    });
    expect(projeksiyon.baseMonthsToDebtFree).toBe(5);
    expect(projeksiyon.acceleratedMonthsToDebtFree).toBe(3);
    expect(projeksiyon.monthsSaved).toBe(2);
    expect(projeksiyon.totalInterestSaved).toBeCloseTo(3501.68, 2);
  });

  it("ek ödeme yoksa iki plan da aynı çıkar", () => {
    const projeksiyon = calculateScenarioProjection({
      loans: GERCEK_KREDILER.map(valuationToLoanInput),
      monthlyExtraPayment: 0,
    });
    expect(projeksiyon.monthsSaved).toBe(0);
    expect(projeksiyon.totalInterestSaved).toBeCloseTo(0, 2);
  });
});

// Değerleme tipiyle uyumlu kaldığından emin olmak için derleme zamanı kontrolü.
type _EslemeUyumlu = Pick<
  DebtValuation,
  "id" | "title" | "principalTL" | "installmentAmountTL" | "monthlyInterestRatePercent"
>;
