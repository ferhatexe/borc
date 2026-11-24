import { describe, it, expect } from "vitest";
import { normalizeText, suggestCategory, wordsMatch, type CategoryLite } from "@/lib/finance/categorize";

const cat = (id: string, name: string, parentId: string | null = null): CategoryLite => ({ id, name, parentId });

const CATS: CategoryLite[] = [
  cat("mg", "Market & Gıda"),
  cat("mg-m", "Market", "mg"),
  cat("mg-y", "Dışarıda Yemek", "mg"),
  cat("mg-k", "Kahve", "mg"),
  cat("ul", "Ulaşım"),
  cat("ul-y", "Yakıt", "ul"),
  cat("ul-t", "Taksi", "ul"),
  cat("sg", "Sağlık"),
  cat("sg-i", "İlaç", "sg"),
  cat("sg-d", "Diş", "sg"),
  cat("gy", "Giyim"),
  cat("gy-g", "Giyim", "gy"),
  cat("bo", "Borç Ödemesi"),
  cat("bo-k", "Kredi Kartı", "bo"),
  cat("eg", "Eğlence"),
  cat("tel", "Telefon & Abonelik"),
  cat("tel-y", "Yazılım/Bulut", "tel"),
];

const id = (text: string, history = []) => suggestCategory(text, CATS, history)?.categoryId ?? null;

describe("normalizeText / wordsMatch", () => {
  it("Türkçe harfleri sadeleştirir", () => {
    expect(normalizeText("  ŞOK Market, Çiğ Köfte! ")).toBe("sok market cig kofte");
    expect(normalizeText("İLAÇ")).toBe("ilac");
  });

  it("ek ve tek harf hatasını tolere eder, kısa sözcükte etmez", () => {
    expect(wordsMatch("marketten", "market")).toBe(true);
    expect(wordsMatch("yemej", "yemek")).toBe(true);
    expect(wordsMatch("marker", "market")).toBe(true);
    expect(wordsMatch("disarida", "dis")).toBe(false);
    expect(wordsMatch("bot", "bit")).toBe(false);
  });
});

describe("suggestCategory", () => {
  it("geçmişte aynı tanım nereye konduysa oraya", () => {
    const history = [
      { merchant: "Yemek", categoryId: "mg-y" },
      { merchant: "yemek", categoryId: "mg-y" },
      { merchant: "Yemek", categoryId: "mg" },
    ];
    expect(suggestCategory("YEMEK", CATS, history)).toEqual({ categoryId: "mg-y", source: "gecmis" });
  });

  it("geçmişte ortak sözcük (yazım hatasıyla) eşleşir", () => {
    const history = [{ merchant: "Halı saha maçı", categoryId: "eg" }];
    expect(suggestCategory("halısaha", CATS, history)?.categoryId).toBe("eg");
    expect(suggestCategory("Hali saha", CATS, history)).toEqual({ categoryId: "eg", source: "gecmis" });
  });

  it("geçmişteki silinmiş kategori yok sayılır", () => {
    expect(id("Kırtasiye", [{ merchant: "Kırtasiye", categoryId: "silinmis" }] as never)).toBeNull();
  });

  it("kategori adının kendisi, alt kategori önce", () => {
    expect(id("kahve")).toBe("mg-k");
    expect(id("giyim alışverişi")).toBe("gy-g");
    expect(id("ilaç")).toBe("sg-i");
  });

  it("sözlükteki marka ve sözcükler", () => {
    expect(id("Migros")).toBe("mg-m");
    expect(id("a101 alışveriş")).toBe("mg-m");
    expect(id("Shell benzin")).toBe("ul-y");
    expect(id("eczane")).toBe("sg-i");
    expect(id("döner")).toBe("mg-y");
    expect(id("Kahve Dünyası")).toBe("mg-k");
    expect(id("bitaksi")).toBe("ul-t");
    expect(id("Claude Pro")).toBe("tel-y");
    expect(id("sinema bileti")).toBe("eg");
    expect(id("Marker kola")).toBe("mg-m");
  });

  it("dışarıda yemek dişe, kartla market borç ödemesine düşmez", () => {
    expect(id("dışarıda yemek")).toBe("mg-y");
    expect(id("kredi kartı ile market")).toBe("mg-m");
  });

  it("günlük sözcükler ve online mağazalar", () => {
    expect(id("su aldım")).toBe("mg-m");
    expect(id("çay")).toBe("mg-k");
    expect(id("çiğköfte")).toBe("mg-y");
    expect(id("trendyol yemek")).toBe("mg-y");
    expect(id("trendyol")).toBe("gy-g");
    expect(id("yol parası")).toBe("ul");
  });

  it("tam eşleşme ek/yazım hatasından önce gelir", () => {
    expect(id("taksit")).toBe("bo"); // Taksi değil
    expect(id("kredi kartı")).toBeNull(); // "martı" (taksi) değil
    expect(id("trendyol")).not.toBe("ul"); // "tren" değil
  });

  it("yazım hatasında ilk harf tutmalı, 4 harfte uzunluk değişmez", () => {
    expect(wordsMatch("karti", "marti")).toBe(false);
    expect(wordsMatch("mama", "magma")).toBe(false);
    expect(wordsMatch("yemej", "yemek")).toBe(true);
  });

  it("bilinmeyen tanımda öneri yok", () => {
    expect(id("xyzq")).toBeNull();
    expect(id("")).toBeNull();
  });
});
