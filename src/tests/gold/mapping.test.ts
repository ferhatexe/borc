import { describe, it, expect } from "vitest";
import { buildGoldRecords, parsePrice } from "@/lib/gold/mapping";
import { mapTruncgilRates } from "@/lib/gold/truncgilAdapter";
import { isPieceGoldType } from "@/lib/gold/types";

describe("parsePrice", () => {
  it("sayıyı olduğu gibi döndürür", () => {
    expect(parsePrice(6864.36)).toBe(6864.36);
  });

  it("nokta ayraçlı metni çözer", () => {
    expect(parsePrice("6864.36")).toBe(6864.36);
  });

  it("Türkçe biçimli metni çözer (1.234,56)", () => {
    expect(parsePrice("11.165,67")).toBe(11165.67);
  });

  it("geçersiz girdide 0 döner, NaN üretmez", () => {
    expect(parsePrice("abc")).toBe(0);
    expect(parsePrice(null)).toBe(0);
    expect(parsePrice(undefined)).toBe(0);
    expect(parsePrice(Number.NaN)).toBe(0);
  });
});

describe("Altın ürün sınıflandırması", () => {
  it("adet bazlı ürünleri tanır", () => {
    expect(isPieceGoldType("CEYREK")).toBe(true);
    expect(isPieceGoldType("YARIM")).toBe(true);
    expect(isPieceGoldType("TAM")).toBe(true);
    expect(isPieceGoldType("ATA")).toBe(true);
    expect(isPieceGoldType("GREMSE")).toBe(true);
  });

  it("gram bazlı ürünleri tanır", () => {
    expect(isPieceGoldType("BILEZIK_22")).toBe(false);
    expect(isPieceGoldType("ZINCIR_21_HALEP")).toBe(false);
    expect(isPieceGoldType("GRAM_ALTIN")).toBe(false);
    expect(isPieceGoldType("KULCE")).toBe(false);
  });
});

describe("buildGoldRecords", () => {
  const pure = { buy: 6863.55, sell: 6864.36 };

  it("has altın fiyatını temel alır", () => {
    const res = buildGoldRecords({ pure });
    expect(res.pureGramSellTL).toBeCloseTo(6864.36, 2);
    expect(res.pureGramBuyTL).toBeCloseTo(6863.55, 2);
  });

  it("yayınlanmayan 21 ayarı milyemden türetir, sabit uydurmaz", () => {
    const res = buildGoldRecords({ pure });
    const halep = res.prices.find((p) => p.goldType === "ZINCIR_21_HALEP");

    expect(halep).toBeDefined();
    expect(halep!.sellPrice).toBeCloseTo((6864.36 * 875) / 1000, 1);
    expect(halep!.karat).toBe(21);
    expect(halep!.isPiece).toBe(false);
  });

  it("adet bazlı ürün fiyatı yoksa ürünü listeden düşürür (fiyat uydurmaz)", () => {
    const res = buildGoldRecords({ pure });
    expect(res.prices.find((p) => p.goldType === "CEYREK")).toBeUndefined();

    const withCeyrek = buildGoldRecords({ pure, ceyrek: { buy: 10908, sell: 11165 } });
    expect(withCeyrek.prices.find((p) => p.goldType === "CEYREK")?.sellPrice).toBe(11165);
  });

  it("marj uygulamaz - marjlar kullanıcı ayarıdır", () => {
    const res = buildGoldRecords({ pure });
    const halep = res.prices.find((p) => p.goldType === "ZINCIR_21_HALEP")!;
    // 200 TL'lik çarşı marjı burada eklenmemeli.
    expect(halep.sellPrice).toBeLessThan((6864.36 * 875) / 1000 + 1);
  });

  it("adet ürünlerinin gram ağırlıklarını taşır", () => {
    const res = buildGoldRecords({
      pure,
      ceyrek: { buy: 1, sell: 1 },
      tam: { buy: 1, sell: 1 },
      ata: { buy: 1, sell: 1 },
    });
    expect(res.prices.find((p) => p.goldType === "CEYREK")?.effectiveGrams).toBe(1.75);
    expect(res.prices.find((p) => p.goldType === "TAM")?.effectiveGrams).toBe(7.0);
    expect(res.prices.find((p) => p.goldType === "ATA")?.effectiveGrams).toBe(7.216);
  });
});

describe("Truncgil yanıt eşleme", () => {
  // Gerçek v4 yanıtından alınmış örnek.
  const rates = {
    USD: { Buying: 48.381, Selling: 48.4899, Type: "Currency" },
    GRA: { Buying: 6898.04, Selling: 6898.85, Type: "Gold", Name: "GRAMALTIN" },
    HAS: { Buying: 6863.55, Selling: 6864.36, Type: "Gold", Name: "GRAMHASALTIN" },
    CEYREKALTIN: { Buying: 10908.86, Selling: 11165.67, Type: "Gold" },
    YARIMALTIN: { Buying: 21749.55, Selling: 22331.33, Type: "Gold" },
    TAMALTIN: { Buying: 43635.46, Selling: 44526.08, Type: "Gold" },
    ATAALTIN: { Buying: 44999.06, Selling: 46165.08, Type: "Gold" },
    GREMSEALTIN: { Buying: 109088.64, Selling: 111656.67, Type: "Gold" },
    YIA: { Buying: 6218.05, Selling: 6228.19, Type: "Gold", Name: "22AYARBILEZIK" },
    "18AYARALTIN": { Buying: 4977.17, Selling: 4985.28, Type: "Gold" },
    "14AYARALTIN": { Buying: 3886.28, Selling: 3892.62, Type: "Gold" },
  };

  it("gerçek yanıt şemasını ürün kataloğuna çevirir", () => {
    const res = mapTruncgilRates(rates);

    expect(res.pureGramSellTL).toBeCloseTo(6864.36, 2);
    expect(res.prices.find((p) => p.goldType === "CEYREK")?.sellPrice).toBeCloseTo(11165.67, 2);
    expect(res.prices.find((p) => p.goldType === "YARIM")?.sellPrice).toBeCloseTo(22331.33, 2);
    expect(res.prices.find((p) => p.goldType === "TAM")?.sellPrice).toBeCloseTo(44526.08, 2);
    expect(res.prices.find((p) => p.goldType === "BILEZIK_22")?.sellPrice).toBeCloseTo(6228.19, 2);
    expect(res.prices.find((p) => p.goldType === "BILEZIK_18")?.sellPrice).toBeCloseTo(4985.28, 2);
  });

  it("REGRESYON: gram altın 3.380 TL gibi sabit bir değere düşmez", () => {
    const res = mapTruncgilRates(rates);
    expect(res.pureGramSellTL).toBeGreaterThan(5000);
  });

  it("has altın yoksa gram altına düşer", () => {
    const { HAS: _HAS, ...withoutHas } = rates;
    const res = mapTruncgilRates(withoutHas);
    expect(res.pureGramSellTL).toBeCloseTo(6898.85, 2);
  });

  it("hiç altın fiyatı yoksa hata fırlatır (sessizce uydurmaz)", () => {
    expect(() => mapTruncgilRates({ USD: { Buying: 48, Selling: 48 } })).toThrow();
  });
});
