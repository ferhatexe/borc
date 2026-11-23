import { describe, it, expect } from "vitest";
import { dueAfterCut, splitCardBalance } from "@/lib/finance/cardStatement";

const noon = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12));
const day = (d: Date) => d.toISOString().slice(0, 10);

describe("dueAfterCut", () => {
  it("son ödeme günü kesimden sonraysa aynı ay", () => {
    expect(day(dueAfterCut(noon(2026, 11, 4), 14))).toBe("2026-11-14");
  });
  it("kesimle aynı gün ya da önceyse bir sonraki ay", () => {
    expect(day(dueAfterCut(noon(2026, 11, 4), 4))).toBe("2026-12-04");
    expect(day(dueAfterCut(noon(2026, 11, 25), 5))).toBe("2026-12-05");
  });
  it("kısa ayda son güne kayar", () => {
    expect(day(dueAfterCut(noon(2027, 1, 31), 30))).toBe("2027-02-28");
  });
});

describe("splitCardBalance", () => {
  // Kesim 4'ü, son ödeme 14'ü. Bugün 21 Kasım.
  const base = { statementDay: 4, dueDay: 14, now: noon(2026, 11, 21) };

  it("kesimden sonraki harcama bir sonraki ekstreye kalır", () => {
    const s = splitCardBalance({
      ...base,
      balance: 1500,
      purchases: [
        { date: noon(2026, 11, 2), amount: 1000 }, // kesimden önce: bu ekstre
        { date: noon(2026, 11, 4), amount: 200 }, // kesim günü: bu ekstre
        { date: noon(2026, 11, 10), amount: 300 }, // kesimden sonra
      ],
    });
    expect(day(s.lastCut)).toBe("2026-11-04");
    expect(s.statementTL).toBe(1200);
    expect(day(s.statementDue)).toBe("2026-11-14");
    expect(s.nextTL).toBe(300);
    expect(day(s.nextDue)).toBe("2026-12-14");
  });

  it("ekstre ödendiyse yalnız sonraki kısım kalır", () => {
    const s = splitCardBalance({ ...base, balance: 300, purchases: [{ date: noon(2026, 11, 10), amount: 300 }] });
    expect(s.statementTL).toBe(0);
    expect(s.nextTL).toBe(300);
  });

  it("ödeme yeni harcamaları da kapattıysa bakiye kadar sayılır", () => {
    const s = splitCardBalance({ ...base, balance: 100, purchases: [{ date: noon(2026, 11, 10), amount: 300 }] });
    expect(s.statementTL).toBe(0);
    expect(s.nextTL).toBe(100);
  });

  it("kesimden önceki günlerde son kesim geçen aydır", () => {
    const s = splitCardBalance({ ...base, now: noon(2026, 11, 3), balance: 500, purchases: [{ date: noon(2026, 10, 20), amount: 500 }] });
    expect(day(s.lastCut)).toBe("2026-10-04");
    expect(s.nextTL).toBe(500);
    expect(day(s.nextDue)).toBe("2026-11-14");
  });

  it("İstanbul gece yarısı: UTC'de önceki gün olan harcama doğru güne yazılır", () => {
    // 4 Kasım 22:30 UTC = 5 Kasım 01:30 İstanbul -> kesimden sonra
    const s = splitCardBalance({ ...base, balance: 50, purchases: [{ date: "2026-11-04T22:30:00Z", amount: 50 }] });
    expect(s.nextTL).toBe(50);
  });
});
