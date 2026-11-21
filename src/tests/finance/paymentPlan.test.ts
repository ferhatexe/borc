import { describe, it, expect } from "vitest";
import {
  buildPayoffOptions,
  coverPayments,
  horizonDaysFor,
  monthKey,
  nearReliefTL,
  reopensLimit,
  sortPayoffOptions,
  type PayoffOption,
  type PlanPayment,
} from "@/lib/finance/paymentPlan";
import type { DebtWithRelations } from "@/lib/db/debts";
import type { DebtValuation } from "@/lib/finance/debtValuation";

const pay = (debtId: string, date: string, amountTL: number): PlanPayment => ({
  key: `${debtId}:${date}`,
  debtId,
  title: debtId,
  institutionName: null,
  dueDate: new Date(`${date}T12:00:00Z`).toISOString(),
  amountTL,
  isOverdue: false,
});

describe("coverPayments", () => {
  const payments = [
    pay("kart", "2026-12-04", 1000),
    pay("ekhesap", "2026-12-04", 500),
    pay("kredi", "2026-12-19", 3000),
    pay("avans", "2026-12-24", 4000),
    pay("kredi", "2027-01-19", 3000),
  ];

  it("ödemeleri tarih sırasıyla düşer, yetmeyen kısmı eksik yazar", () => {
    const months = coverPayments(payments, 5000);
    expect(months.map((m) => m.month)).toEqual(["2026-12", "2027-01"]);
    const dec = months[0];
    expect(dec.totalTL).toBe(8500);
    expect(dec.payments[2].cashAfterTL).toBe(500);
    expect(dec.payments[3].shortTL).toBe(3500);
    expect(dec.payments[3].cashAfterTL).toBe(0);
    expect(dec.shortTL).toBe(3500);
    expect(months[1].shortTL).toBe(3000);
  });

  it("peşin kapatılan borcun ödemeleri listeden çıkar", () => {
    const months = coverPayments(payments, 0, new Set(["kredi"]));
    expect(months[0].payments.map((p) => p.debtId)).toEqual(["kart", "ekhesap", "avans"]);
    expect(months).toHaveLength(1);
  });

  it("eksi para sıfır sayılır", () => {
    const months = coverPayments([pay("a", "2026-12-01", 100)], -50);
    expect(months[0].shortTL).toBe(100);
  });
});

describe("yardımcılar", () => {
  it("ay anahtarı İstanbul saatine göre", () => {
    // 31 Aralık 22:30 UTC, İstanbul'da 1 Ocak.
    expect(monthKey("2026-12-31T22:30:00Z")).toBe("2027-01");
  });

  it("ufuk, n. ayın sonuna kadar", () => {
    const now = new Date(2026, 10, 21, 12);
    // 21 Kasım -> 28 Şubat sonu: 4 takvim ayı (Kas, Ara, Oca, Şub)
    expect(horizonDaysFor(4, now)).toBe(100);
  });

  it("ek hesaba bağlı ürünleri tanır", () => {
    expect(reopensLimit({ type: "TAKSITLI_KREDI", title: "Banka A Taksitli Ek Hesap" })).toBe(true);
    expect(reopensLimit({ type: "TAKSITLI_KREDI", title: "Banka B - Taksitli Avans" })).toBe(true);
    expect(reopensLimit({ type: "TAKSITLI_KREDI", title: "Banka C Ay Sonu Hesabı" })).toBe(true);
    expect(reopensLimit({ type: "EK_HESAP_KMH", title: "Banka C" })).toBe(true);
    expect(reopensLimit({ type: "TAKSITLI_KREDI", title: "Banka B - İhtiyaç Kredisi" })).toBe(false);
  });
});

describe("peşin kapama seçenekleri", () => {
  const loan = {
    id: "kredi",
    type: "TAKSITLI_KREDI",
    title: "Banka B - İhtiyaç Kredisi",
    status: "AKTIF",
    institution: { name: "Banka B" },
    installmentSchedules: [
      { status: "ODENDI", totalAmount: 2000, dueDate: new Date("2026-10-19T12:00:00Z") },
      { status: "BEKLIYOR", totalAmount: 2000, dueDate: new Date("2026-12-19T12:00:00Z") },
      { status: "BEKLIYOR", totalAmount: 2000, dueDate: new Date("2027-01-19T12:00:00Z") },
      { status: "BEKLIYOR", totalAmount: 2000.01, dueDate: new Date("2027-02-19T12:00:00Z") },
    ],
  } as unknown as DebtWithRelations;
  const kmh = {
    id: "kmh",
    type: "EK_HESAP_KMH",
    title: "Banka C Ek Hesap",
    status: "AKTIF",
    institution: null,
    installmentSchedules: [],
  } as unknown as DebtWithRelations;
  const gold = { id: "au", type: "ALTIN_BORCU", title: "Altın", status: "AKTIF", installmentSchedules: [] } as unknown as DebtWithRelations;

  const vals = [
    { id: "kredi", outstandingTL: 5600, dailyAccrualTL: 8, nextDueDate: "2026-12-19T12:00:00.000Z" },
    { id: "kmh", outstandingTL: 5000, dailyAccrualTL: 10, nextDueDate: null },
    { id: "au", outstandingTL: 100000, dailyAccrualTL: 0, nextDueDate: null },
  ] as unknown as DebtValuation[];

  const options = buildPayoffOptions([loan, kmh, gold], vals);

  it("kredide kalan taksitleri ve kurtulan faizi hesaplar, altını almaz", () => {
    expect(options.map((o) => o.debtId)).toEqual(["kredi", "kmh"]);
    const k = options[0];
    expect(k.futurePaymentsTL).toBe(6000.01);
    expect(k.interestSavedTL).toBe(400.01);
    expect(k.reliefByMonth["2026-12"]).toBe(2000);
    expect(k.reopensLimit).toBe(false);
    expect(nearReliefTL(k, ["2026-12", "2027-01"])).toBe(4000);
  });

  it("ek hesapta aylık faizi gösterir ve limit açılır der", () => {
    const k = options[1];
    expect(k.monthlyInterestTL).toBe(300);
    expect(k.interestSavedTL).toBe(0);
    expect(k.reopensLimit).toBe(true);
  });

  it("seçilen ölçüte göre sıralar", () => {
    const a: PayoffOption = { ...options[0], debtId: "a", payoffTL: 100, interestSavedTL: 50, reliefByMonth: { "2026-12": 10 }, nextDueDate: "2027-01-01", monthlyInterestTL: null };
    const b: PayoffOption = { ...options[0], debtId: "b", payoffTL: 100, interestSavedTL: 5, reliefByMonth: { "2026-12": 90 }, nextDueDate: "2026-12-01", monthlyInterestTL: null };
    const months = ["2026-12"];
    expect(sortPayoffOptions([a, b], "yuk", months).map((o) => o.debtId)).toEqual(["b", "a"]);
    expect(sortPayoffOptions([a, b], "faiz", months).map((o) => o.debtId)).toEqual(["a", "b"]);
    expect(sortPayoffOptions([a, b], "vade", months).map((o) => o.debtId)).toEqual(["b", "a"]);
  });
});
