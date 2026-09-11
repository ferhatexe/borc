import { describe, it, expect } from "vitest";
import { buildPortfolioSummary, valuateDebt } from "@/lib/finance/debtValuation";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { DebtWithRelations } from "@/lib/db/debts";
import type { GoldSyncResult } from "@/lib/gold/types";

const NOW = new Date(2026, 8, 15); // 15 Eylül 2026

const gold: GoldSyncResult = {
  prices: [
    { goldType: "GRAM_ALTIN", name: "Gram Altın", karat: 24, buyPrice: 6863, sellPrice: 6864, isPiece: false, effectiveGrams: 1, isDerived: false },
    { goldType: "CEYREK", name: "Çeyrek", karat: 22, buyPrice: 10908, sellPrice: 11165, isPiece: true, effectiveGrams: 1.75, isDerived: false },
    // Kotasyonu olmayan urun: milyem formulunden turetilir.
    { goldType: "ZINCIR_21_HALEP", name: "21 Ayar Halep", karat: 21, buyPrice: 6005, sellPrice: 6006, isPiece: false, effectiveGrams: 1, isDerived: true },
    { goldType: "BILEZIK_22", name: "22 Ayar Bilezik", karat: 22, buyPrice: 6285, sellPrice: 6287, isPiece: false, effectiveGrams: 1, isDerived: true },
  ],
  pureGramSellTL: 6864,
  pureGramBuyTL: 6863,
  pureGramChangePercent: -0.74,
  currencies: [
    { code: "USD", name: "Amerikan Doları", buyPrice: 48.38, sellPrice: 48.49, changePercent: 0.22 },
  ],
  ounce: { usd: 4402.8, tryValue: 213485.4, basis: "DERIVED" },
  providerUpdatedAt: null,
  source: "test",
  sourceKind: "LIVE",
  fetchedAt: NOW.toISOString(),
  isCached: false,
  cacheExpiresInSeconds: 900,
  isStale: false,
  ageMinutes: 0,
  warning: null,
};

/** Minimal debt row with sensible defaults for the fields under test. */
function debt(overrides: Partial<DebtWithRelations>): DebtWithRelations {
  return {
    id: "d1",
    userId: "u1",
    institutionId: null,
    institution: null,
    type: "DIGER",
    title: "Test",
    description: null,
    status: "AKTIF",
    currency: "TRY",
    startDate: new Date(2026, 0, 1),
    createdAt: NOW,
    updatedAt: NOW,
    notes: null,
    tags: [],
    color: null,
    isArchived: false,
    loanSubType: null,
    principal: null,
    interestRateMonthly: null,
    installmentCount: null,
    installmentAmount: null,
    firstPaymentDate: null,
    paymentDayOfMonth: null,
    paidInstallments: 0,
    includeKKDF: true,
    kkdfRate: null,
    includeBSMV: true,
    bsmvRate: null,
    earlyPayoffEnabled: false,
    loanAccountNo: null,
    cardName: null,
    last4: null,
    creditLimit: null,
    currentStatementBalance: null,
    minimumPayment: null,
    statementDay: null,
    dueDay: null,
    contractualInterestMonthly: null,
    overdueInterestMonthly: null,
    installmentsOnCard: null,
    limit: null,
    usedAmount: null,
    lastInterestChargeDate: null,
    accrualBasis: null,
    goldType: null,
    quantity: null,
    grams: null,
    karat: null,
    priceSource: null,
    manualUnitPrice: null,
    premiumTL: null,
    creditorName: null,
    dueDate: null,
    isInterestFree: null,
    creditorPhone: null,
    amount: null,
    hasInterest: null,
    installmentPlan: null,
    documentType: null,
    documentNo: null,
    drawee: null,
    frequency: null,
    nextDueDate: null,
    autoCreateExpense: false,
    installmentSchedules: [],
    payments: [],
    ...overrides,
  } as unknown as DebtWithRelations;
}

function schedule(no: number, dueDate: Date, status: string, remaining: number, principal: number, total: number) {
  return {
    id: `s${no}`,
    debtId: "d1",
    installmentNo: no,
    dueDate,
    totalAmount: total,
    principalPart: principal,
    interestPart: total - principal,
    remainingPrincipal: remaining,
    status,
    paidAt: null,
    paidAmount: null,
  } as never;
}

describe("Taksitli kredi değerlemesi", () => {
  const loan = debt({
    type: "TAKSITLI_KREDI",
    title: "QNB İhtiyaç",
    installmentAmount: 10348 as never,
    interestRateMonthly: 3.5 as never,
    paymentDayOfMonth: 15,
    installmentSchedules: [
      schedule(1, new Date(2026, 7, 15), "ODENDI", 93151, 6848, 10348),
      schedule(2, new Date(2026, 8, 15), "BEKLIYOR", 86063, 7088, 10348),
      schedule(3, new Date(2026, 9, 15), "BEKLIYOR", 78727, 7336, 10348),
    ] as never,
  });

  it("kalan anaparayı ilk ödenmemiş taksitten türetir", () => {
    const v = valuateDebt(loan, gold, DEFAULT_SETTINGS, NOW);
    // remainingPrincipal taksit SONRASI bakiye; bugunku anapara ona o taksitin
    // anapara payi eklenerek bulunur.
    expect(v.principalTL).toBeCloseTo(86063 + 7088, 2);
    // 15 Agustos'ta odenen taksitten bugune isleyen faiz de kapamaya girer;
    // bir taksitin faiz payi (10.348 - 7.088) tavandir.
    expect(v.accruedInterestTL).toBeCloseTo(3260, 2);
    expect(v.outstandingTL).toBeCloseTo(86063 + 7088 + 3260, 2);
    expect(v.paidInstallments).toBe(1);
    expect(v.remainingInstallments).toBe(2);
    expect(v.totalInstallments).toBe(3);
  });

  it("REGRESYON: sadece bu ay vadesi dolan ödenmemiş taksiti 'bu ay ödenecek' sayar", () => {
    const v = valuateDebt(loan, gold, DEFAULT_SETTINGS, NOW);
    // Eylül'de tek bir bekleyen taksit var; Ağustos ödenmiş, Ekim gelecek ay.
    expect(v.dueThisMonthTL).toBeCloseTo(10348, 2);
  });

  it("REGRESYON: tüm taksitleri ödenmiş kredi bu ay ödenecek tutara eklenmez", () => {
    const closed = debt({
      ...loan,
      installmentSchedules: [
        schedule(1, new Date(2026, 7, 15), "ODENDI", 0, 10348, 10348),
        schedule(2, new Date(2026, 8, 15), "ODENDI", 0, 10348, 10348),
      ] as never,
    });
    const v = valuateDebt(closed, gold, DEFAULT_SETTINGS, NOW);
    expect(v.dueThisMonthTL).toBe(0);
    expect(v.outstandingTL).toBe(0);
  });

  it("vadesi geçmiş taksiti gecikmiş olarak işaretler", () => {
    const overdue = debt({
      ...loan,
      installmentSchedules: [schedule(1, new Date(2026, 7, 15), "BEKLIYOR", 90000, 7000, 10348)] as never,
    });
    expect(valuateDebt(overdue, gold, DEFAULT_SETTINGS, NOW).isOverdue).toBe(true);
  });
});

describe("KMH değerlemesi", () => {
  it("son tahakkuk tarihinden bugüne işleyen faizi toplam borca ekler", () => {
    const kmh = debt({
      type: "EK_HESAP_KMH",
      title: "Artı Para",
      limit: 20000 as never,
      usedAmount: 10000 as never,
      interestRateMonthly: 5 as never,
      lastInterestChargeDate: new Date(2026, 7, 31), // 15 gün önce
    });

    const v = valuateDebt(kmh, gold, DEFAULT_SETTINGS, NOW);
    const expectedInterest = ((10000 * 0.05 * 15) / 30) * 1.3;

    expect(v.principalTL).toBe(10000);
    expect(v.accruedInterestTL).toBeCloseTo(expectedInterest, 1);
    expect(v.outstandingTL).toBeCloseTo(10000 + expectedInterest, 1);
    expect(v.overdraftDetail?.accrualDays).toBe(15);
    expect(v.overdraftDetail?.utilizationPercent).toBeCloseTo(50, 1);
    expect(v.dailyAccrualTL).toBeGreaterThan(0);
  });

  it("REGRESYON: faiz oranı yoksa uydurma %5 kullanılmaz", () => {
    const kmh = debt({
      type: "EK_HESAP_KMH",
      limit: 20000 as never,
      usedAmount: 10000 as never,
      interestRateMonthly: null,
      lastInterestChargeDate: new Date(2026, 7, 15),
    });
    expect(valuateDebt(kmh, gold, DEFAULT_SETTINGS, NOW).accruedInterestTL).toBe(0);
  });
});

describe("Kredi kartı değerlemesi", () => {
  it("bu ay ödenecek tutar kartın tamamıdır; asgari yalnızca bilgi olarak durur", () => {
    const card = debt({
      type: "KREDI_KARTI",
      title: "Bonus",
      creditLimit: 50000 as never,
      currentStatementBalance: 20000 as never,
      minimumPayment: 4000 as never,
      dueDay: 25,
    });
    const v = valuateDebt(card, gold, DEFAULT_SETTINGS, NOW);
    expect(v.dueThisMonthTL).toBe(20000);
    expect(v.cardDetail?.minimumPayment).toBe(4000);
    expect(v.isOverdue).toBe(false);
    expect(v.nextDueDate).toBe(new Date(2026, 8, 25).toISOString());
  });

  it("asgari tanımlı değilse ayardaki orandan hesaplanır ve bilgi olarak gösterilir", () => {
    const card = debt({
      type: "KREDI_KARTI",
      creditLimit: 50000 as never,
      currentStatementBalance: 20000 as never,
      dueDay: 25,
    });
    const v = valuateDebt(card, gold, DEFAULT_SETTINGS, NOW);
    expect(v.cardDetail?.minimumPayment).toBeCloseTo(20000 * 0.2, 2);
    expect(v.dueThisMonthTL).toBe(20000);
  });

  it("REGRESYON: ödeme günü bu ay geçtiyse sıradaki vade gelecek ayın günüdür, gecikme sayılmaz", () => {
    // Ayın 4'ünde ödenen kart 11'inde gecikmiş sayılıp gecikme faizi
    // işletiliyordu. Bakiye son ödemeden sonraki yeni harcamalar; 4 Ekim'de ödenir.
    const card = debt({
      type: "KREDI_KARTI",
      creditLimit: 15000 as never,
      currentStatementBalance: 7949.3 as never,
      statementDay: 4,
      dueDay: 4,
      contractualInterestMonthly: 4.25 as never,
      overdueInterestMonthly: 4.55 as never,
    });
    const v = valuateDebt(card, gold, DEFAULT_SETTINGS, NOW); // 15 Eylül
    expect(v.isOverdue).toBe(false);
    expect(v.accruedInterestTL).toBe(0);
    expect(v.outstandingTL).toBe(7949.3);
    expect(v.nextDueDate).toBe(new Date(2026, 9, 4).toISOString());
    // Vade Ekim'de: Eylül'ün yükümlülüğüne girmez.
    expect(v.dueThisMonthTL).toBe(0);
  });

  it("son ödeme günü geçtiği hâlde kart o günden beri hiç güncellenmediyse gecikme faizi işletir", () => {
    const card = debt({
      type: "KREDI_KARTI",
      creditLimit: 50000 as never,
      currentStatementBalance: 20000 as never,
      minimumPayment: 4000 as never,
      dueDay: 5, // 15 Eylül itibarıyla 10 gün gecikmiş
      contractualInterestMonthly: 4.25 as never,
      overdueInterestMonthly: 4.75 as never,
      updatedAt: new Date(2026, 7, 1), // 5 Eylül'den önce: ne ödeme ne harcama
    });
    const v = valuateDebt(card, gold, DEFAULT_SETTINGS, NOW);
    expect(v.isOverdue).toBe(true);
    expect(v.accruedInterestTL).toBeGreaterThan(0);
    expect(v.outstandingTL).toBeGreaterThan(20000);
    expect(v.nextDueDate).toBe(new Date(2026, 8, 5).toISOString());
    expect(v.dueThisMonthTL).toBe(20000);
  });

  it("kart üzerindeki taksitli harcamaların aylık toplamını çıkarır", () => {
    const card = debt({
      type: "KREDI_KARTI",
      creditLimit: 50000 as never,
      currentStatementBalance: 20000 as never,
      dueDay: 25,
      installmentsOnCard: [
        { description: "Beyaz eşya", totalAmount: 12000, installmentCount: 12, remainingInstallments: 7, monthlyAmount: 1000 },
        { description: "Bitmiş", totalAmount: 6000, installmentCount: 6, remainingInstallments: 0, monthlyAmount: 1000 },
      ] as never,
    });
    const v = valuateDebt(card, gold, DEFAULT_SETTINGS, NOW);
    expect(v.cardDetail?.installmentsOnCardMonthlyTL).toBe(1000);
  });
});

describe("Altın borcu değerlemesi", () => {
  it("KABUL KRİTERİ 4: 21 ayarda ayardaki +200 TL marj uygulanır", () => {
    const g = debt({
      type: "ALTIN_BORCU",
      title: "Halep zinciri",
      goldType: "ZINCIR_21_HALEP" as never,
      grams: 100 as never,
      karat: 21,
      premiumTL: null, // ayardaki varsayılan kullanılmalı
    });

    const v = valuateDebt(g, gold, DEFAULT_SETTINGS, NOW);
    const expected = (100 * 875 * 6864) / 1000 + 100 * 200;
    expect(v.outstandingTL).toBeCloseTo(expected, 0);
  });

  it("KABUL KRİTERİ 4: 22 ayar bilezikte marj uygulanmaz", () => {
    const g = debt({
      type: "ALTIN_BORCU",
      goldType: "BILEZIK_22" as never,
      grams: 50 as never,
      karat: 22,
    });
    const v = valuateDebt(g, gold, DEFAULT_SETTINGS, NOW);
    expect(v.outstandingTL).toBeCloseTo((50 * 916 * 6864) / 1000, 0);
  });

  it("KABUL KRİTERİ 5: çeyrek altın adet bazında değerlenir", () => {
    const g = debt({
      type: "ALTIN_BORCU",
      goldType: "CEYREK" as never,
      quantity: 4 as never,
    });
    const v = valuateDebt(g, gold, DEFAULT_SETTINGS, NOW);
    expect(v.outstandingTL).toBeCloseTo(4 * 11165, 0);
    expect(v.goldDetail?.isPiece).toBe(true);
  });

  it("gercek kotasyon varsa milyem formulu yerine o kullanilir", () => {
    // 21 ayar icin anlikaltinfiyati.com'dan gelen gram fiyati (isDerived: false)
    const quoted = {
      ...gold,
      prices: gold.prices.map((p) =>
        p.goldType === "ZINCIR_21_HALEP"
          ? { ...p, sellPrice: 6023.53, isDerived: false, source: "anlikaltinfiyati.com" }
          : p
      ),
    };

    const g = debt({
      type: "ALTIN_BORCU",
      goldType: "ZINCIR_21_HALEP" as never,
      grams: 100 as never,
      karat: 21,
    });

    const v = valuateDebt(g, quoted, DEFAULT_SETTINGS, NOW);
    // Kotasyon x gram + ayardaki 200 TL/gr marj
    expect(v.outstandingTL).toBeCloseTo(6023.53 * 100 + 200 * 100, 0);

    // Milyem yolu (6864 x 875/1000 = 6006) kullanilsaydi daha dusuk cikardi.
    const derivedValue = (100 * 875 * 6864) / 1000 + 100 * 200;
    expect(v.outstandingTL).toBeGreaterThan(derivedValue);
  });

  it("kotasyon yoksa milyem formulune duser", () => {
    const g = debt({
      type: "ALTIN_BORCU",
      goldType: "ZINCIR_21_HALEP" as never,
      grams: 100 as never,
      karat: 21,
    });
    const v = valuateDebt(g, gold, DEFAULT_SETTINGS, NOW);
    expect(v.outstandingTL).toBeCloseTo((100 * 875 * 6864) / 1000 + 100 * 200, 0);
  });

  it("fiyat yoksa uydurma kur kullanmaz", () => {
    const g = debt({
      type: "ALTIN_BORCU",
      goldType: "BILEZIK_22" as never,
      grams: 50 as never,
      amount: 250000 as never,
    });
    const v = valuateDebt(g, null, DEFAULT_SETTINGS, NOW);
    expect(v.outstandingTL).toBe(250000); // kayıtlı TL tutarı
    expect(v.goldDetail).toBeNull();
  });
});

describe("Düzenli ödeme değerlemesi", () => {
  it("yıllık ödeme her ay 'bu ay ödenecek'e eklenmez", () => {
    const yearly = debt({
      type: "DUZENLI_ODEME",
      title: "Kasko",
      amount: 12000 as never,
      frequency: "YILLIK" as never,
      nextDueDate: new Date(2026, 2, 10), // Mart
    });
    const v = valuateDebt(yearly, gold, DEFAULT_SETTINGS, NOW); // Eylül
    expect(v.dueThisMonthTL).toBe(0);
  });

  it("aylık ödeme bu aya düşer", () => {
    const monthly = debt({
      type: "DUZENLI_ODEME",
      title: "Kira",
      amount: 25000 as never,
      frequency: "AYLIK" as never,
      nextDueDate: new Date(2026, 8, 5),
    });
    expect(valuateDebt(monthly, gold, DEFAULT_SETTINGS, NOW).dueThisMonthTL).toBe(25000);
  });
});

describe("Portföy özeti", () => {
  it("KABUL KRİTERİ 1: aynı bankadaki farklı krediler ayrı ayrı listelenir", () => {
    const qnb = { id: "i1", name: "QNB Finansbank", color: "#8B0000" };

    const debts = [
      debt({
        id: "a", title: "QNB İhtiyaç 1", institutionId: "i1", institution: qnb as never,
        type: "TAKSITLI_KREDI", interestRateMonthly: 3.5 as never, installmentAmount: 5000 as never,
        paymentDayOfMonth: 5,
        installmentSchedules: [schedule(1, new Date(2026, 8, 5), "BEKLIYOR", 20000, 3000, 5000)] as never,
      }),
      debt({
        id: "b", title: "QNB İhtiyaç 2", institutionId: "i1", institution: qnb as never,
        type: "TAKSITLI_KREDI", interestRateMonthly: 4.2 as never, installmentAmount: 3000 as never,
        paymentDayOfMonth: 20,
        installmentSchedules: [schedule(1, new Date(2026, 8, 20), "BEKLIYOR", 10000, 2000, 3000)] as never,
      }),
      debt({
        id: "c", title: "QNB Taşıt", institutionId: "i1", institution: qnb as never,
        type: "TAKSITLI_KREDI", interestRateMonthly: 2.1 as never, installmentAmount: 7000 as never,
        paymentDayOfMonth: 28,
        installmentSchedules: [schedule(1, new Date(2026, 8, 28), "BEKLIYOR", 50000, 5000, 7000)] as never,
      }),
    ];

    const summary = buildPortfolioSummary(debts, gold, DEFAULT_SETTINGS, NOW);
    const qnbGroup = summary.institutionBreakdown.find((i) => i.institutionId === "i1")!;

    expect(qnbGroup.debtCount).toBe(3);
    expect(qnbGroup.debts).toHaveLength(3);
    expect(qnbGroup.debts.map((d) => d.monthlyInterestRatePercent)).toEqual([3.5, 4.2, 2.1]);
    expect(qnbGroup.debts.map((d) => d.paymentDayOfMonth)).toEqual([5, 20, 28]);
    expect(qnbGroup.monthlyObligationTL).toBe(15000);

    // Anaparalar 90.000; ustune son taksitten bugune isleyen faiz biner, ama
    // hicbir kredide bir taksitin faiz payindan fazlasi islemez.
    const principals = 23000 + 12000 + 55000;
    expect(qnbGroup.totalOutstandingTL).toBeGreaterThan(principals);
    expect(qnbGroup.totalOutstandingTL).toBeLessThanOrEqual(
      principals + 2000 + 1000 + 2000
    );
  });

  it("taksitli kredi kapama tutari her gun buyur, taksit odenince sifirlanir", () => {
    // 100.000 TL kalan anapara, aylik %3 akdi faiz, vadesi 1 Eylul'de gecmis
    // bir taksit ve 1 Ekim'de bekleyen bir taksit.
    const loan = debt({
      id: "k1",
      type: "TAKSITLI_KREDI",
      title: "Kapama testi",
      interestRateMonthly: 3 as never,
      installmentAmount: 12000 as never,
      startDate: new Date(2026, 5, 1),
      installmentSchedules: [
        schedule(1, new Date(2026, 8, 1), "ODENDI", 100000, 8000, 12000),
        schedule(2, new Date(2026, 9, 1), "BEKLIYOR", 92000, 8000, 12000),
      ] as never,
    });

    // 1 Eylul'deki taksitten 15 gun sonra: 100.000 x %3 x 1,30 x 15/30.
    const v = valuateDebt(loan, gold, DEFAULT_SETTINGS, NOW);
    expect(v.principalTL).toBe(100000);
    // 1 Eylul -> 15 Eylul = 14 gun.
    expect(v.accruedInterestTL).toBeCloseTo(1820, 2);
    expect(v.outstandingTL).toBeCloseTo(101820, 2);
    expect(v.dailyAccrualTL).toBeCloseTo(130, 2);
    expect(v.accrualSince).toBe(new Date(2026, 8, 1).toISOString());

    // Ertesi gun bir gunluk faiz daha binmis olmali.
    const yarin = valuateDebt(loan, gold, DEFAULT_SETTINGS, new Date(2026, 8, 16));
    expect(yarin.outstandingTL - v.outstandingTL).toBeCloseTo(130, 2);

    // Vade gunu geldiginde bir aylik faiz birikmis olur (30 x 130 = 3.900).
    // Taksit odenmedigi surece faiz islemeye devam eder ama bir taksitin faiz
    // payini (4.000) gecemez; tavana dayanınca gunluk artis da durur.
    const vadeGunu = valuateDebt(loan, gold, DEFAULT_SETTINGS, new Date(2026, 9, 1));
    expect(vadeGunu.accruedInterestTL).toBeCloseTo(3900, 2);
    expect(vadeGunu.dailyAccrualTL).toBeCloseTo(130, 2);

    const gecikmis = valuateDebt(loan, gold, DEFAULT_SETTINGS, new Date(2026, 9, 10));
    expect(gecikmis.accruedInterestTL).toBe(4000);
    expect(gecikmis.dailyAccrualTL).toBe(0);

    // Ekim taksiti de odenince anapara duser ve faiz sifirdan baslar.
    const sonraki = debt({
      ...loan,
      installmentSchedules: [
        schedule(1, new Date(2026, 8, 1), "ODENDI", 100000, 8000, 12000),
        schedule(2, new Date(2026, 9, 1), "ODENDI", 92000, 8000, 12000),
        schedule(3, new Date(2026, 10, 1), "BEKLIYOR", 84000, 8000, 12000),
      ] as never,
    });
    const odemeGunu = valuateDebt(sonraki, gold, DEFAULT_SETTINGS, new Date(2026, 9, 1));
    expect(odemeGunu.principalTL).toBe(92000);
    expect(odemeGunu.accruedInterestTL).toBe(0);
    expect(odemeGunu.outstandingTL).toBe(92000);
  });

  it("REGRESYON: kurumu olmayan borçlar kırılımdan düşmez", () => {
    const summary = buildPortfolioSummary(
      [debt({ id: "x", title: "Arkadaş borcu", type: "KISI_BORCU", amount: 5000 as never, creditorName: "Ali" })],
      gold,
      DEFAULT_SETTINGS,
      NOW
    );
    expect(summary.institutionBreakdown).toHaveLength(1);
    expect(summary.institutionBreakdown[0].institutionName).toBe("Kurumsuz / Kişisel");
    expect(summary.totalDebtTL).toBe(5000);
  });

  it("yaklaşan ödemeleri 30 günlük pencerede vadeye göre sıralar", () => {
    const debts = [
      debt({
        id: "a", title: "Kredi", type: "TAKSITLI_KREDI",
        installmentSchedules: [
          schedule(1, new Date(2026, 8, 25), "BEKLIYOR", 20000, 3000, 5000),
          schedule(2, new Date(2026, 8, 18), "BEKLIYOR", 17000, 3000, 5000),
          schedule(3, new Date(2026, 11, 18), "BEKLIYOR", 14000, 3000, 5000), // ufuk dışı
        ] as never,
      }),
    ];

    const summary = buildPortfolioSummary(debts, gold, DEFAULT_SETTINGS, NOW);
    expect(summary.upcomingPayments).toHaveLength(2);
    expect(new Date(summary.upcomingPayments[0].dueDate).getDate()).toBe(18);
    expect(summary.upcomingPayments[0].daysUntilDue).toBe(3);
  });
});
