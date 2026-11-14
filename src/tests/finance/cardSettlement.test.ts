import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isCardSettlement } from "@/lib/db/transactions";

/**
 * Kart borcu ödemesi harcama raporunda ikinci kez sayılmasın.
 *
 * Alışveriş kartla yapıldığı gün gider olarak yazılıyor; kart ödendiğinde
 * payInstallment bir gider daha açıyor. Rapor ikisini de topluyordu.
 */
const KOK = path.resolve(__dirname, "../../..");
const oku = (rel: string) => fs.readFileSync(path.join(KOK, rel), "utf8");

describe("isCardSettlement", () => {
  it("karta havale/nakit ile yapılan ödeme kart ödemesidir", () => {
    expect(isCardSettlement({ paymentMethod: "HAVALE", relatedDebt: { type: "KREDI_KARTI" } })).toBe(true);
    expect(isCardSettlement({ paymentMethod: "NAKIT", relatedDebt: { type: "KREDI_KARTI" } })).toBe(true);
  });

  it("kartla yapılan alışveriş harcamadır", () => {
    expect(isCardSettlement({ paymentMethod: "KREDI_KARTI", relatedDebt: { type: "KREDI_KARTI" } })).toBe(false);
  });

  it("kredi taksiti ödemesi harcama olarak kalır (şartname §6.2)", () => {
    expect(isCardSettlement({ paymentMethod: "HAVALE", relatedDebt: { type: "TAKSITLI_KREDI" } })).toBe(false);
  });

  it("borca bağlı olmayan gider harcamadır", () => {
    expect(isCardSettlement({ paymentMethod: "NAKIT", relatedDebt: null })).toBe(false);
    expect(isCardSettlement({ paymentMethod: "NAKIT" })).toBe(false);
  });
});

describe("Harcama toplamları kart ödemesini dışarıda bırakır", () => {
  it("analitik raporu", () => {
    const s = oku("src/lib/db/reports.ts");
    expect(s).toMatch(/const expenses = allExpenses\.filter\(\(e\) => !isCardSettlement\(e\)\)/);
  });

  it("ayın gideri (canlı özet ve ana sayfa aynı yardımcıyı kullanır)", () => {
    expect(oku("src/app/api/live/route.ts")).toContain("monthlyTotals(");
    expect(oku("src/app/page.tsx")).toContain("monthlyTotals(");
    expect(oku("src/lib/db/transactions.ts")).toMatch(/\.filter\(\(e\) => !isCardSettlement\(e\)\)/);
  });

  it("kasa bakiyesi ödemeyi düşmeye devam eder (filtre orada yok)", () => {
    const s = oku("src/lib/db/transactions.ts");
    const g = s.slice(s.indexOf("export async function getCashBalance"));
    expect(g).not.toContain("isCardSettlement");
  });
});

describe("Ayın gelir/gider özeti", () => {
  it("REGRESYON: kartla alışveriş harcamaya girer ama bu ay kasadan çıkmaz", async () => {
    const { monthlyTotals } = await import("@/lib/db/transactions");
    const m = monthlyTotals(
      [],
      [
        { amount: 2275.7, paymentMethod: "KREDI_KARTI", relatedDebt: { type: "KREDI_KARTI" } },
        { amount: 100, paymentMethod: "NAKIT", relatedDebt: null },
      ],
      0
    );
    expect(m.expenseTL).toBeCloseTo(2375.7, 2);
    expect(m.netTL).toBeCloseTo(-2375.7, 2);
    // Kart vadesi bu aya düşmüyorsa nakit akışında yalnız nakit harcama var.
    expect(m.cashFlowTL).toBeCloseTo(-100, 2);
  });

  it("kart borcunu ödemek harcama sayılmaz, kasadan çıkar", async () => {
    const { monthlyTotals } = await import("@/lib/db/transactions");
    const m = monthlyTotals([{ amount: 5000 }], [{ amount: 2275.7, paymentMethod: "HAVALE", relatedDebt: { type: "KREDI_KARTI" } }], 0);
    expect(m.expenseTL).toBe(0);
    expect(m.cashFlowTL).toBeCloseTo(5000 - 2275.7, 2);
  });

  it("REGRESYON: kartla harcama karta bağlanmadan kaybolmaz", () => {
    const src = fs.readFileSync(path.join(__dirname, "../../lib/db/transactions.ts"), "utf8");
    expect(src).toMatch(/paymentMethod === "KREDI_KARTI" && !relatedDebtId/);
    expect(src).toContain("Kredi kartı kaydı yok");
  });
});
