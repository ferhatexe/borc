import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { calculateEarlyPayoff } from "@/lib/finance/earlyPayoff";
import { calculateOverdraftInterest } from "@/lib/finance/overdraft";
import { principalAfterPayment } from "@/lib/finance/loanPayment";

/**
 * Veritabanına dokunan kurallar için kaynak düzeyinde koruma, ve taksit
 * ödemesi sonrası bakiye kuralının gerçek banka rakamlarıyla sınanması.
 *
 * Bu depoda veritabanlı test altyapısı yok; kasa bakiyesi ve taksit ödemesi
 * Prisma sorgusunun içinde. O kurallar kod metninden doğrulanır, davranışın
 * kendisi canlı veritabanında uçtan uca denendi.
 */
const KOK = path.resolve(__dirname, "../../..");

function govde(dosya: string, baslangic: string): string {
  const s = fs.readFileSync(path.join(KOK, dosya), "utf8");
  const i = s.indexOf(baslangic);
  if (i === -1) throw new Error(`${baslangic} bulunamadı`);
  const j = s.indexOf("\nexport ", i + baslangic.length);
  return s.slice(i, j === -1 ? undefined : j);
}

/** Değerlemenin kullandığı formül: anapara x aylık oran x (1 + KKDF + BSMV) x gün / 30. */
const islemisFaiz = (anapara: number, aylikOran: number, gun: number) =>
  calculateOverdraftInterest({
    usedAmount: anapara,
    monthlyInterestRatePercent: aylikOran,
    days: gun,
    includeKKDF: true,
    kkdfRate: 0.15,
    includeBSMV: true,
    bsmvRate: 0.15,
  }).totalAccruedInterest.toNumber();

describe("Kasa bakiyesi", () => {
  it("REGRESYON: kredi kartıyla yapılan harcama kasadan düşülmez", () => {
    // Kart harcaması kartın borcunu artırıyor. Kasadan da düşülünce aynı
    // alışveriş, kart borcu ödendiğinde ikinci kez sayılıyordu.
    const g = govde("src/lib/db/transactions.ts", "export async function getCashBalance");
    expect(g).toMatch(/paymentMethod:\s*\{\s*not:\s*"KREDI_KARTI"\s*\}/);
  });
});

describe("Taksit ödemesinden sonra kalan anapara - gerçek banka ödemeleri", () => {
  it("QNB 27.000 TL: 23 gün sonra 7.958,68 ödendi, banka kalan 20.653,23 diyor", () => {
    const kapama = 27000 + islemisFaiz(27000, 5.99, 23);
    expect(principalAfterPayment(kapama, 7958.68)).toBeCloseTo(20653.23, 2);
  });

  it("QNB 40.000 TL: 4 gün sonra 5.294,98 ödendi, banka kalan 35.023,95 diyor", () => {
    const kapama = 40000 + islemisFaiz(40000, 4.6, 4);
    expect(principalAfterPayment(kapama, 5294.98)).toBeCloseTo(35023.95, 2);
  });

  it("REGRESYON: plandaki anapara payını düşmek erken ödemede yanlış sonuç verir", () => {
    // 27.000 TL kredide 1. taksitin plandaki anapara payı 6.346,77 değildi;
    // eski kural bankanın 20.653,23'ünü ancak tesadüfen tutturabilirdi. Doğru
    // kural ödeneni önce işlemiş faize sayıyor.
    const faiz = islemisFaiz(27000, 5.99, 23);
    const anaparayaGiden = 7958.68 - faiz;
    expect(anaparayaGiden).toBeCloseTo(6346.77, 2);
    expect(faiz).toBeGreaterThan(1600);
  });

  it("borçtan fazla ödeme bakiyeyi eksiye düşürmez", () => {
    expect(principalAfterPayment(1000, 1500)).toBe(0);
  });
});

describe("Taksit ödemesi (kaynak)", () => {
  it("elle girilmiş bakiye ödemeyle düşer: ödeme anındaki kapama tutarı - ödenen", () => {
    const g = govde("src/lib/db/debts.ts", "export async function payInstallment");
    expect(g).toContain("currentPrincipalOverride: true");
    expect(g).toMatch(/valuateDebt\(\s*tam,\s*null,\s*settings,\s*paidAt\s*\)\.outstandingTL/);
    expect(g).toContain("principalAfterPayment(payoffBefore");
    expect(g).toContain("debtUpdate.principalOverrideAt = paidAt");
  });

  it("kapama tutarı taksit ödendi olarak işaretlenmeden önce okunur", () => {
    // Faiz tavanı bekleyen ilk taksite bakıyor; önce işaretlenirse tavan bir
    // sonraki taksitten okunur ve kapama tutarı yanlış çıkar.
    const g = govde("src/lib/db/debts.ts", "export async function payInstallment");
    const okuma = g.indexOf("payoffBefore = valuateDebt(");
    const isaret = g.indexOf('status: "ODENDI", paidAt');
    expect(okuma).toBeGreaterThan(-1);
    expect(isaret).toBeGreaterThan(-1);
    expect(okuma).toBeLessThan(isaret);
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
      remainingPrincipal: 14846.14,
      amortizationSchedule: [],
      paidInstallmentCount: 0,
    });
    expect(res.penaltyFee.toNumber()).toBe(0);
    expect(res.totalPayoffAmount.toNumber()).toBe(14846.14);
  });
});
