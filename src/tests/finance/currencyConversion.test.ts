import { describe, it, expect } from "vitest";
import { valuateDebt, buildPortfolioSummary } from "@/lib/finance/debtValuation";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { GoldSyncResult } from "@/lib/gold/types";
import type { DebtWithRelations } from "@/lib/db/debts";

const NOW = new Date(2026, 8, 15);

const gold: GoldSyncResult = {
  prices: [
    { goldType: "BILEZIK_22", name: "22 Ayar", karat: 22, buyPrice: 6218, sellPrice: 6228.19, isPiece: false, effectiveGrams: 1, isDerived: false },
  ],
  pureGramSellTL: 6864.36,
  pureGramBuyTL: 6863.55,
  pureGramChangePercent: null,
  currencies: [
    { code: "USD", name: "Dolar", buyPrice: 48.381, sellPrice: 48.4899, changePercent: 0.22 },
    { code: "EUR", name: "Euro", buyPrice: 56.12, sellPrice: 56.3586, changePercent: -0.25 },
  ],
  ounce: null, providerUpdatedAt: null, source: "test", sourceKind: "LIVE",
  fetchedAt: NOW.toISOString(), isCached: false, cacheExpiresInSeconds: 900,
  isStale: false, ageMinutes: 0, warning: null,
};

function debt(fields: Record<string, unknown>): DebtWithRelations {
  return {
    id: "d", userId: "u", type: "DIGER", title: "Borç", status: "AKTIF",
    currency: "TRY", institutionId: null, institution: null,
    startDate: NOW, createdAt: NOW, updatedAt: NOW, isArchived: false,
    tags: [], notes: null, color: null, description: null,
    installmentSchedules: [], payments: [],
    ...fields,
  } as unknown as DebtWithRelations;
}

describe("Döviz cinsi borçların TL karşılığı", () => {
  it("REGRESYON: USD borç dolar kuruyla çevrilir", () => {
    // Eskiden 1.000 $ borç, toplamda 1.000 TL gibi sayiliyordu.
    const v = valuateDebt(
      debt({ currency: "USD", amount: 1000, type: "KISI_BORCU", creditorName: "Ali" }),
      gold, DEFAULT_SETTINGS, NOW
    );
    expect(v.outstandingTL).toBeCloseTo(1000 * 48.4899, 2);
    expect(v.fxRateToTRY).toBeCloseTo(48.4899, 4);
    expect(v.outstandingTL).toBeGreaterThan(40000);
  });

  it("EUR borç euro kuruyla çevrilir", () => {
    const v = valuateDebt(
      debt({ currency: "EUR", amount: 500, type: "SENET_CEK", documentType: "SENET" }),
      gold, DEFAULT_SETTINGS, NOW
    );
    expect(v.outstandingTL).toBeCloseTo(500 * 56.3586, 2);
  });

  it("TL borçta çevrim uygulanmaz", () => {
    const v = valuateDebt(debt({ currency: "TRY", amount: 1000 }), gold, DEFAULT_SETTINGS, NOW);
    expect(v.outstandingTL).toBe(1000);
    expect(v.fxRateToTRY).toBe(1);
  });

  it("altın borcu iki kez çevrilmez", () => {
    // Altin zaten gram x fiyat ile TL'ye cevrildi; ustune kur uygulanmamali.
    const v = valuateDebt(
      debt({ currency: "XAU", type: "ALTIN_BORCU", goldType: "BILEZIK_22", grams: 10, karat: 22 }),
      gold, DEFAULT_SETTINGS, NOW
    );
    expect(v.fxRateToTRY).toBe(1);
    // 22 ayar icin gercek kotasyon kullanilir (milyem formulu degil).
    expect(v.outstandingTL).toBeCloseTo(10 * 6228.19, 2);
  });

  it("kur yoksa tutar olduğu gibi bırakılır, uydurma kur kullanılmaz", () => {
    const v = valuateDebt(
      debt({ currency: "USD", amount: 1000, type: "KISI_BORCU" }),
      null, DEFAULT_SETTINGS, NOW
    );
    expect(v.outstandingTL).toBe(1000);
    expect(v.fxRateToTRY).toBe(1);
  });

  it("toplam borç döviz kalemleri dahil doğru", () => {
    const summary = buildPortfolioSummary(
      [
        debt({ id: "a", currency: "TRY", amount: 10000, type: "KISI_BORCU" }),
        debt({ id: "b", currency: "USD", amount: 1000, type: "KISI_BORCU" }),
      ],
      gold, DEFAULT_SETTINGS, NOW
    );
    expect(summary.totalDebtTL).toBeCloseTo(10000 + 1000 * 48.4899, 1);
  });
});
