import { describe, it, expect } from "vitest";
import {
  EMPTY_COACH_STATE,
  buildStreakView,
  checkIn,
  dayDiff,
  istanbulDay,
  normalizeCoachState,
  recordGamble,
} from "@/lib/coach/streak";
import { buildInsights, type InsightInput } from "@/lib/coach/insights";
import { parseLocaleNumber, sanitizeNumberText, numberToInputText } from "@/lib/parseNumber";
import type { DebtValuation, UpcomingPayment } from "@/lib/finance/debtValuation";

describe("Kumarsız gün serisi", () => {
  const kurulu = recordGamble(EMPTY_COACH_STATE, "2026-10-24", 16000, "2026-11-10");

  it("seri son oynanan günden bugüne sayılır", () => {
    const v = buildStreakView(kurulu, "2026-11-10");
    expect(v.isSetUp).toBe(true);
    expect(v.days).toBe(17);
    expect(v.totalLostTL).toBe(16000);
    expect(v.nextMilestone).toBe(30);
    expect(v.daysToMilestone).toBe(13);
  });

  it("günlük işaret o günü temiz yapar, seriyi değiştirmez", () => {
    const s = checkIn(kurulu, "2026-11-10");
    const v = buildStreakView(s, "2026-11-10");
    expect(v.checkedInToday).toBe(true);
    expect(v.days).toBe(17);
    expect(v.week.at(-1)).toEqual({ date: "2026-11-10", status: "clean" });
    // İkinci kez işaretlemek bir şey değiştirmez.
    expect(checkIn(s, "2026-11-10")).toBe(s);
  });

  it("unutulan gün seriyi bozmaz", () => {
    const s = checkIn(kurulu, "2026-11-08");
    const v = buildStreakView(s, "2026-11-10");
    expect(v.days).toBe(17);
    expect(v.week.find((d) => d.date === "2026-11-09")?.status).toBe("none");
    expect(v.week.at(-1)?.status).toBe("pending");
  });

  it("oynanan gün seriyi sıfırlar, en iyi seriyi korur", () => {
    const s = recordGamble(checkIn(kurulu, "2026-11-10"), "2026-11-10", 500, "2026-11-10");
    const v = buildStreakView(s, "2026-11-10");
    expect(v.days).toBe(0);
    expect(v.bestStreak).toBe(17);
    expect(v.checkedInToday).toBe(false);
    expect(v.week.at(-1)?.status).toBe("relapse");
    expect(v.totalLostTL).toBe(16500);
    // Oynanan gün "oynamadım" diye işaretlenemez.
    expect(checkIn(s, "2026-11-10")).toBe(s);
    expect(buildStreakView(s, "2026-11-11").days).toBe(1);
  });

  it("son 30 günün kaybını ayrı toplar", () => {
    const s = recordGamble(kurulu, "2026-09-01", 1000, "2026-11-10"); // eski kayıt, seriyi bozmaz
    const v = buildStreakView(s, "2026-11-10");
    expect(v.days).toBe(17);
    expect(v.totalLostTL).toBe(17000);
    expect(v.lostLast30DaysTL).toBe(16000);
  });

  it("gelecek tarihli bildirimi yok sayar, bozuk veriyi temizler", () => {
    expect(recordGamble(kurulu, "2026-12-01", 5, "2026-11-10")).toBe(kurulu);
    expect(normalizeCoachState({ lastGambleDay: "dün", checkins: [1, "2026-11-01"], bestStreak: -3 })).toEqual({
      lastGambleDay: null,
      checkins: ["2026-11-01"],
      relapses: [],
      bestStreak: 0,
    });
  });

  it("gün, İstanbul saatine göre döner", () => {
    // 21:30 UTC = İstanbul'da ertesi gün 00:30
    expect(istanbulDay(new Date("2026-11-10T21:30:00Z"))).toBe("2026-11-11");
    expect(dayDiff("2026-10-24", "2026-11-10")).toBe(17);
  });
});

describe("Bilgi kartları", () => {
  const val = (o: Partial<DebtValuation>): DebtValuation =>
    ({ id: "x", title: "X", type: "TAKSITLI_KREDI", outstandingTL: 0, dailyAccrualTL: 0, monthlyInterestRatePercent: null, remainingInstallments: null, installmentAmountTL: null, ...o }) as DebtValuation;
  const pay = (o: Partial<UpcomingPayment>): UpcomingPayment =>
    ({ debtId: "a", installmentId: null, title: "A", amountTL: 0, dueDate: "2026-12-04", daysUntilDue: 0, isOverdue: false, kind: "TAKSIT", ...o }) as UpcomingPayment;

  const base: InsightInput = {
    valuations: [
      val({ id: "is", title: "İş Bankası", outstandingTL: 9996.39, dailyAccrualTL: 16.39, monthlyInterestRatePercent: 3.79, remainingInstallments: 6, installmentAmountTL: 1961.65 }),
      val({ id: "g60", title: "Garanti 60k", outstandingTL: 62292.16, dailyAccrualTL: 120.64, monthlyInterestRatePercent: 4.64 }),
    ],
    upcoming: [pay({ debtId: "is", title: "İş Bankası", amountTL: 1912.48, daysUntilDue: 24 })],
    cashTL: 0,
    totalDebtTL: 640000,
    bankDebtTL: 228000,
    goldDebtTL: 412000,
    dailyAccrualTL: 427.42,
    accruedInterestTL: 4000,
    streak: null,
  };
  const ids = (i: InsightInput) => buildInsights(i).map((x) => x.id);

  it("en yakın ödemeyi ve kasanın yetip yetmediğini söyler", () => {
    const next = buildInsights(base).find((i) => i.id === "next-payment")!;
    expect(next.title).toBe("24 gün sonra: İş Bankası");
    expect(next.body).toContain("karşılayacak nakit görünmüyor");
    const zengin = buildInsights({ ...base, cashTL: 5000 }).find((i) => i.id === "next-payment")!;
    expect(zengin.body).toContain("karşılıyor");
  });

  it("gecikme varsa en başa onu koyar", () => {
    const i = { ...base, upcoming: [pay({ isOverdue: true, amountTL: 100, daysUntilDue: -3 }), ...base.upcoming] };
    expect(ids(i)[0]).toBe("overdue");
  });

  it("en yüksek faizli ve en küçük borcu ayrı kartlarda verir", () => {
    const list = buildInsights(base);
    expect(list.find((i) => i.id === "highest-rate")?.title).toContain("Garanti 60k");
    expect(list.find((i) => i.id === "smallest")?.title).toContain("İş Bankası");
  });

  it("kumara giden parayı günlük faizle kıyaslar; kayıp yoksa kart çıkmaz", () => {
    expect(ids(base)).not.toContain("gamble-cost");
    const streak = buildStreakView(recordGamble(EMPTY_COACH_STATE, "2026-10-24", 16000, "2026-11-10"), "2026-11-10");
    const card = buildInsights({ ...base, streak }).find((i) => i.id === "gamble-cost")!;
    expect(card.body).toContain("37 günlük faiz"); // 16.000 / 427,42
  });

  it("borç yokken kart üretmez", () => {
    expect(buildInsights({ ...base, valuations: [], upcoming: [], dailyAccrualTL: 0, goldDebtTL: 0, totalDebtTL: 0 })).toEqual([]);
  });
});

describe("Sayı alanı çözümleme", () => {
  it("REGRESYON: kuruşlu ve binlik ayırıcılı tutarları kabul eder", () => {
    expect(parseLocaleNumber("117.042,60")).toBe(117042.6);
    expect(parseLocaleNumber("2435,50")).toBe(2435.5);
    expect(parseLocaleNumber("2435.50")).toBe(2435.5);
    expect(parseLocaleNumber("1.250.000")).toBe(1250000);
    expect(parseLocaleNumber("4.25")).toBe(4.25);
    expect(parseLocaleNumber("12,")).toBe(12);
  });

  it("boş ve bozuk metinde 0 uydurmaz", () => {
    expect(parseLocaleNumber("")).toBeNull();
    expect(parseLocaleNumber(",")).toBeNull();
    expect(parseLocaleNumber("abc")).toBeNull();
  });

  it("yazarken harfleri atar, tam sayı alanında ayırıcı bırakmaz", () => {
    expect(sanitizeNumberText("12a,5,0", false)).toBe("12,50");
    expect(sanitizeNumberText("1,5", true)).toBe("15");
    expect(numberToInputText(2435.5)).toBe("2435,5");
    expect(numberToInputText("")).toBe("");
  });
});
