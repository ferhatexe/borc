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

  it("ayın gideri (canlı özet)", () => {
    const s = oku("src/app/api/live/route.ts");
    expect(s).toMatch(/\.filter\(\(e\) => !isCardSettlement\(e\)\)\s*\.reduce/);
  });

  it("kasa bakiyesi ödemeyi düşmeye devam eder (filtre orada yok)", () => {
    const s = oku("src/lib/db/transactions.ts");
    const g = s.slice(s.indexOf("export async function getCashBalance"));
    expect(g).not.toContain("isCardSettlement");
  });
});
