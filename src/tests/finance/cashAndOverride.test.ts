import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { calculateEarlyPayoff } from "@/lib/finance/earlyPayoff";

/**
 * Veritabanına dokunan iki kural için kaynak düzeyinde koruma.
 *
 * Bu depoda veritabanlı test altyapısı yok; kasa bakiyesi ve taksit ödemesi
 * Prisma sorgusunun içinde. Kural kod metninden doğrulanır, davranışın kendisi
 * canlı veritabanında uçtan uca denendi. Biri kuralı geri alırsa burası kırılır.
 */
const KOK = path.resolve(__dirname, "../../..");

function govde(dosya: string, baslangic: string): string {
  const s = fs.readFileSync(path.join(KOK, dosya), "utf8");
  const i = s.indexOf(baslangic);
  if (i === -1) throw new Error(`${baslangic} bulunamadı`);
  const j = s.indexOf("\nexport ", i + baslangic.length);
  return s.slice(i, j === -1 ? undefined : j);
}

describe("Kasa bakiyesi", () => {
  it("REGRESYON: kredi kartıyla yapılan harcama kasadan düşülmez", () => {
    // Kart harcaması kartın borcunu artırıyor. Kasadan da düşülünce aynı
    // alışveriş, kart borcu ödendiğinde ikinci kez sayılıyordu.
    const g = govde("src/lib/db/transactions.ts", "export async function getCashBalance");
    expect(g).toMatch(/paymentMethod:\s*\{\s*not:\s*"KREDI_KARTI"\s*\}/);
  });
});

describe("Taksit ödemesi", () => {
  it("REGRESYON: elle girilmiş banka bakiyesi ödenen taksitin anapara payı kadar düşer", () => {
    // Değerleme elle girilmiş bakiyeyi plana tercih ediyor; ödemede bu değer
    // yerinde kalınca kredi, taksidi ödendiği hâlde aynı anaparayı gösteriyordu.
    const g = govde("src/lib/db/debts.ts", "export async function payInstallment");
    expect(g).toContain("currentPrincipalOverride: true");
    expect(g).toMatch(/currentPrincipalOverride\)\.minus\(\s*installment\.principalPart/);
    expect(g).toContain("debtUpdate.principalOverrideAt = paidAt");
  });

  it("son taksit ödenince elle girilmiş bakiye tamamen kalkar", () => {
    const g = govde("src/lib/db/debts.ts", "export async function payInstallment");
    expect(g).toMatch(/pendingCount === 0\)\s*\{\s*debtUpdate\.currentPrincipalOverride = null/);
  });
});

describe("Erken kapama komisyonu", () => {
  it("varsayılanı sıfırdır; kullanıcının bankaları erken ödemede indirim uyguluyor", () => {
    expect(DEFAULT_SETTINGS.taxRates.earlyPayoffPenaltyRate).toBe(0);
  });

  it("oran verilmezse kapama tutarına komisyon eklenmez", () => {
    const res = calculateEarlyPayoff({
      remainingPrincipal: 15690.88,
      amortizationSchedule: [],
      paidInstallmentCount: 0,
    });
    expect(res.penaltyFee.toNumber()).toBe(0);
    expect(res.totalPayoffAmount.toNumber()).toBe(15690.88);
  });
});
