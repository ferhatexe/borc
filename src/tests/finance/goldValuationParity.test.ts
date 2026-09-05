import { describe, it, expect } from "vitest";
import { calculateGoldDebtLiveTL } from "@/lib/finance/goldValuation";
import { valuateDebt } from "@/lib/finance/debtValuation";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { GoldPriceRecord, GoldSyncResult } from "@/lib/gold/types";
import type { DebtWithRelations } from "@/lib/db/debts";

/**
 * Sihirbazdaki önizleme ile kaydedilen borcun aynı tutarı vermesi gerekir.
 *
 * Bu testin sebebi gerçek bir hata: form kendi içinde koda gömülü bir fiyat
 * tablosu tutuyordu (gram has altın 3.350 TL) ve önizlemede 3.133,60 TL/gr
 * gösterip kaydettikten sonra 6.223,53 TL/gr'a dönüyordu.
 */

const PRICES: GoldPriceRecord[] = [
  { goldType: "GRAM_ALTIN", name: "Gram Altın", karat: 24, buyPrice: 6898, sellPrice: 6898.85, isPiece: false, effectiveGrams: 1, isDerived: false },
  { goldType: "CEYREK", name: "Çeyrek", karat: 22, buyPrice: 10908, sellPrice: 11165.67, isPiece: true, effectiveGrams: 1.75, isDerived: false },
  { goldType: "BILEZIK_22", name: "22 Ayar Bilezik", karat: 22, buyPrice: 6218, sellPrice: 6228.19, isPiece: false, effectiveGrams: 1, isDerived: false },
  { goldType: "ZINCIR_21_HALEP", name: "21 Ayar Halep", karat: 21, buyPrice: 6023.53, sellPrice: 6023.53, isPiece: false, effectiveGrams: 1, isDerived: false, source: "anlikaltinfiyati.com" },
  { goldType: "KULCE", name: "Külçe", karat: 24, buyPrice: 6863, sellPrice: 6864.36, isPiece: false, effectiveGrams: 1, isDerived: true },
];

const PURE = 6864.36;

const gold: GoldSyncResult = {
  prices: PRICES,
  pureGramSellTL: PURE,
  pureGramBuyTL: 6863.55,
  pureGramChangePercent: null,
  currencies: [],
  ounce: null,
  providerUpdatedAt: null,
  source: "test",
  sourceKind: "LIVE",
  fetchedAt: new Date().toISOString(),
  isCached: false,
  cacheExpiresInSeconds: 900,
  isStale: false,
  ageMinutes: 0,
  warning: null,
};

const opts = {
  millesimalMap: DEFAULT_SETTINGS.goldMillesimal,
  margins: DEFAULT_SETTINGS.goldMargins,
};

/** Kaydedilmiş borç satırı (sunucu tarafı değerleme bunu görür). */
function savedDebt(fields: Record<string, unknown>): DebtWithRelations {
  return {
    id: "d", userId: "u", institutionId: null, institution: null,
    type: "ALTIN_BORCU", title: "Altın", description: null, status: "AKTIF",
    currency: "TRY", startDate: new Date(), createdAt: new Date(), updatedAt: new Date(),
    notes: null, tags: [], color: null, isArchived: false,
    quantity: null, grams: null, karat: null, premiumTL: null,
    priceSource: "CANLI", manualUnitPrice: null, creditorName: null, dueDate: null,
    installmentSchedules: [], payments: [],
    ...fields,
  } as unknown as DebtWithRelations;
}

describe("Önizleme ve kayıt aynı tutarı üretmeli", () => {
  const senaryolar = [
    { ad: "21 ayar 100 gr", goldType: "ZINCIR_21_HALEP", grams: 100, karat: 21 },
    { ad: "21 ayar 20 gr", goldType: "ZINCIR_21_HALEP", grams: 20, karat: 21 },
    { ad: "22 ayar 50 gr", goldType: "BILEZIK_22", grams: 50, karat: 22 },
    { ad: "gram altın 10 gr", goldType: "GRAM_ALTIN", grams: 10, karat: 24 },
    { ad: "külçe 5 gr (kotasyonsuz)", goldType: "KULCE", grams: 5, karat: 24 },
  ];

  for (const s of senaryolar) {
    it(`${s.ad}: form önizlemesi = sunucu değerlemesi`, () => {
      // Formun gösterdiği
      const onizleme = calculateGoldDebtLiveTL(
        { goldType: s.goldType, grams: s.grams, karat: s.karat, quantity: null, premiumTL: null },
        PRICES,
        PURE,
        opts
      );

      // Kaydedildikten sonra sunucunun hesapladığı
      const kayit = valuateDebt(
        savedDebt({ goldType: s.goldType, grams: s.grams, karat: s.karat }),
        gold,
        DEFAULT_SETTINGS
      );

      expect(onizleme.totalTL).toBeCloseTo(kayit.outstandingTL, 2);
    });
  }

  it("adet bazlı: çeyrek 4 adet", () => {
    const onizleme = calculateGoldDebtLiveTL(
      { goldType: "CEYREK", quantity: 4, grams: null, karat: 22, premiumTL: null },
      PRICES, PURE, opts
    );
    const kayit = valuateDebt(
      savedDebt({ goldType: "CEYREK", quantity: 4, karat: 22 }),
      gold, DEFAULT_SETTINGS
    );
    expect(onizleme.totalTL).toBeCloseTo(kayit.outstandingTL, 2);
  });

  it("REGRESYON: 21 ayar birim fiyatı piyasa + 200 olmalı, yarısı değil", () => {
    const res = calculateGoldDebtLiveTL(
      { goldType: "ZINCIR_21_HALEP", grams: 20, karat: 21, quantity: null, premiumTL: null },
      PRICES, PURE, opts
    );

    // Hatali surumde 3.133,60 TL/gr cikiyordu.
    expect(res.unitPriceWithPremiumTL).toBeCloseTo(6023.53 + 200, 2);
    expect(res.unitPriceWithPremiumTL).toBeGreaterThan(6000);
    expect(res.totalTL).toBeCloseTo((6023.53 + 200) * 20, 2);
  });

  it("manuel fiyat girildiğinde iki taraf da onu kullanır", () => {
    const onizleme = calculateGoldDebtLiveTL(
      { goldType: "ZINCIR_21_HALEP", grams: 10, karat: 21, quantity: null,
        priceSource: "MANUEL", manualUnitPrice: 7000, premiumTL: 0 },
      PRICES, PURE, opts
    );
    const kayit = valuateDebt(
      savedDebt({ goldType: "ZINCIR_21_HALEP", grams: 10, karat: 21,
        priceSource: "MANUEL", manualUnitPrice: 7000, premiumTL: 0 }),
      gold, DEFAULT_SETTINGS
    );

    expect(onizleme.totalTL).toBeCloseTo(70000, 2);
    expect(kayit.outstandingTL).toBeCloseTo(70000, 2);
  });
});
