import { describe, it, expect } from "vitest";
import { createDebtSchema, payInstallmentSchema } from "@/lib/validation/debt";
import { createExpenseSchema, createIncomeSchema } from "@/lib/validation/transaction";
import { updateSettingsSchema } from "@/lib/validation/settings";

const baseLoan = {
  type: "TAKSITLI_KREDI",
  title: "QNB İhtiyaç Kredisi 1",
  principal: 100000,
  interestRateMonthly: 3.89,
  installmentCount: 12,
  firstPaymentDate: "2026-10-15",
  paymentDayOfMonth: 15,
};

describe("Borç şeması - koşullu alanlar", () => {
  it("geçerli taksitli krediyi kabul eder", () => {
    const res = createDebtSchema.safeParse(baseLoan);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.firstPaymentDate).toBeInstanceOf(Date);
      expect(res.data.currency).toBe("TRY");
    }
  });

  it("taksitli kredide anapara zorunludur", () => {
    const res = createDebtSchema.safeParse({ ...baseLoan, principal: undefined });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes("principal"))).toBe(true);
    }
  });

  it("aylık %100'ün üstündeki faizi reddeder (yazım hatası koruması)", () => {
    const res = createDebtSchema.safeParse({ ...baseLoan, interestRateMonthly: 389 });
    expect(res.success).toBe(false);
  });

  it("geçersiz tarihi reddeder", () => {
    const res = createDebtSchema.safeParse({ ...baseLoan, firstPaymentDate: "abc" });
    expect(res.success).toBe(false);
  });

  it("ödeme gününü 1-31 aralığında tutar", () => {
    expect(createDebtSchema.safeParse({ ...baseLoan, paymentDayOfMonth: 0 }).success).toBe(false);
    expect(createDebtSchema.safeParse({ ...baseLoan, paymentDayOfMonth: 32 }).success).toBe(false);
    expect(createDebtSchema.safeParse({ ...baseLoan, paymentDayOfMonth: 31 }).success).toBe(true);
  });

  it("altın borcunda adet veya gramdan biri zorunludur", () => {
    const missing = createDebtSchema.safeParse({
      type: "ALTIN_BORCU",
      title: "Halep zinciri",
      goldType: "ZINCIR_21_HALEP",
    });
    expect(missing.success).toBe(false);

    const withGrams = createDebtSchema.safeParse({
      type: "ALTIN_BORCU",
      title: "Halep zinciri",
      goldType: "ZINCIR_21_HALEP",
      grams: 100,
      karat: 21,
      premiumTL: 200,
    });
    expect(withGrams.success).toBe(true);
  });

  it("altın borcunda 0 marj korunur (22 ayar için gerekli)", () => {
    const res = createDebtSchema.safeParse({
      type: "ALTIN_BORCU",
      title: "22 ayar bilezik",
      goldType: "BILEZIK_22",
      grams: 50,
      karat: 22,
      premiumTL: 0,
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.premiumTL).toBe(0);
  });

  it("manuel fiyat seçilince birim fiyat zorunludur", () => {
    const res = createDebtSchema.safeParse({
      type: "ALTIN_BORCU",
      title: "Manuel altın",
      goldType: "GRAM_ALTIN",
      grams: 10,
      priceSource: "MANUEL",
    });
    expect(res.success).toBe(false);
  });

  it("geçersiz ayar değerini reddeder", () => {
    const res = createDebtSchema.safeParse({
      type: "ALTIN_BORCU",
      title: "x",
      goldType: "BILEZIK_22",
      grams: 10,
      karat: 20,
    });
    expect(res.success).toBe(false);
  });

  it("kredi kartında kesim ve son ödeme günü zorunludur", () => {
    expect(
      createDebtSchema.safeParse({
        type: "KREDI_KARTI",
        title: "Bonus",
        creditLimit: 50000,
      }).success
    ).toBe(false);

    expect(
      createDebtSchema.safeParse({
        type: "KREDI_KARTI",
        title: "Bonus",
        creditLimit: 50000,
        statementDay: 5,
        dueDay: 15,
        installmentsOnCard: [
          {
            description: "Beyaz eşya",
            totalAmount: 12000,
            installmentCount: 12,
            remainingInstallments: 7,
            monthlyAmount: 1000,
          },
        ],
      }).success
    ).toBe(true);
  });

  it("KMH'de limit, kullanılan bakiye ve faiz zorunludur", () => {
    expect(
      createDebtSchema.safeParse({ type: "EK_HESAP_KMH", title: "Artı para", limit: 20000 })
        .success
    ).toBe(false);

    expect(
      createDebtSchema.safeParse({
        type: "EK_HESAP_KMH",
        title: "Artı para",
        limit: 20000,
        usedAmount: 0,
        interestRateMonthly: 4.25,
        lastInterestChargeDate: "2026-09-01",
      }).success
    ).toBe(true); // kullanılan bakiye 0 geçerli bir değerdir
  });

  it("kişi borcunda faizli seçilirse oran zorunludur", () => {
    const res = createDebtSchema.safeParse({
      type: "KISI_BORCU",
      title: "Ahmet",
      creditorName: "Ahmet",
      amount: 5000,
      hasInterest: true,
    });
    expect(res.success).toBe(false);
  });

  it("senet/çekte vade zorunludur", () => {
    expect(
      createDebtSchema.safeParse({
        type: "SENET_CEK",
        title: "Senet 1",
        documentType: "SENET",
        amount: 10000,
      }).success
    ).toBe(false);
  });

  it("bilinmeyen borç türünü reddeder", () => {
    expect(createDebtSchema.safeParse({ type: "BILINMEYEN", title: "x" }).success).toBe(false);
  });
});

describe("Ödeme şeması", () => {
  it("sıfır veya negatif ödemeyi reddeder", () => {
    expect(payInstallmentSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(payInstallmentSchema.safeParse({ amount: -5 }).success).toBe(false);
  });

  it("varsayılan olarak gider kaydı oluşturur", () => {
    const res = payInstallmentSchema.safeParse({ amount: 1000 });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.createExpense).toBe(true);
      expect(res.data.method).toBe("HAVALE");
    }
  });
});

describe("Gelir / gider şeması", () => {
  it("sıfır tutarı reddeder", () => {
    expect(createIncomeSchema.safeParse({ categoryId: "c1", amount: 0, source: "Maaş" }).success)
      .toBe(false);
  });

  it("kategori zorunludur", () => {
    expect(createIncomeSchema.safeParse({ amount: 100, source: "Maaş" }).success).toBe(false);
  });

  it("geçersiz tarihi reddeder", () => {
    expect(
      createExpenseSchema.safeParse({ categoryId: "c1", amount: 100, date: "gecersiz" }).success
    ).toBe(false);
  });

  it("bilinmeyen ödeme yöntemini reddeder", () => {
    expect(
      createExpenseSchema.safeParse({ categoryId: "c1", amount: 100, paymentMethod: "BITCOIN" })
        .success
    ).toBe(false);
  });
});

describe("Ayar şeması", () => {
  it("vergi oranını 0-1 aralığında tutar", () => {
    expect(
      updateSettingsSchema.safeParse({
        tax_rates: {
          kkdfRate: 15, // yüzde olarak girilmiş, kesir bekleniyor
          bsmvRate: 0.15,
          earlyPayoffPenaltyRate: 0.02,
          creditCardMinPaymentRate: 0.2,
        },
      }).success
    ).toBe(false);

    expect(
      updateSettingsSchema.safeParse({
        tax_rates: {
          kkdfRate: 0.15,
          bsmvRate: 0.15,
          earlyPayoffPenaltyRate: 0.02,
          creditCardMinPaymentRate: 0.2,
        },
      }).success
    ).toBe(true);
  });

  it("altın marjlarını kabul eder", () => {
    const res = updateSettingsSchema.safeParse({
      gold_margins: { ZINCIR_21_HALEP: 200, BILEZIK_22: 0 },
    });
    expect(res.success).toBe(true);
  });

  it("milyemi 1-1000 aralığında tutar", () => {
    expect(updateSettingsSchema.safeParse({ gold_karat_millesimal: { "22": 1500 } }).success).toBe(
      false
    );
    expect(updateSettingsSchema.safeParse({ gold_karat_millesimal: { "22": 916 } }).success).toBe(
      true
    );
  });

  it("boş gövdeyi reddeder", () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(false);
  });
});
