import { describe, it, expect } from "vitest";
import { initialsFor, motifFor } from "@/components/shared/InstitutionLogo";

describe("Kurum rozeti baş harfleri", () => {
  it("iki kelimeli adlardan ilk harfleri alır", () => {
    expect(initialsFor("QNB Finansbank")).toBe("QF");
    expect(initialsFor("Garanti BBVA")).toBe("GB");
    expect(initialsFor("Yapı Kredi")).toBe("YK");
  });

  it("dolgu kelimelerini atlar", () => {
    // "Bankası" atlanır, geriye tek kelime kalır -> ilk iki harf
    expect(initialsFor("Ziraat Bankası")).toBe("Zİ");
    expect(initialsFor("Kuveyt Türk")).toBe("KU");
  });

  it("tek kelimeli adlarda ilk iki harfi kullanır", () => {
    expect(initialsFor("Akbank")).toBe("AK");
    expect(initialsFor("Papara")).toBe("PA");
  });

  it("REGRESYON: noktalama baş harfe sızmaz", () => {
    expect(initialsFor("Kurumsuz / Kişisel")).toBe("KK");
    expect(initialsFor("Enpara.com")).toBe("EN");
    expect(initialsFor("Albaraka Türk A.Ş.")).toBe("AA");
  });

  it("boş veya bozuk girdide çökmez", () => {
    expect(initialsFor("///")).toBe("?");
    expect(initialsFor("")).toBe("?");
  });
});

describe("Kurum rozeti motifi", () => {
  it("aynı ad her zaman aynı motifi üretir", () => {
    expect(motifFor("QNB Finansbank", "BANKA")).toBe(motifFor("QNB Finansbank", "BANKA"));
    expect(motifFor("Ziraat Bankası", "BANKA")).toBe(motifFor("Ziraat Bankası", "BANKA"));
  });

  it("REGRESYON: banka havuzu yeterince çeşitli", () => {
    const names = [
      "QNB Finansbank", "Ziraat Bankası", "Garanti BBVA", "Yapı Kredi",
      "Akbank", "Halkbank", "VakıfBank", "DenizBank", "TEB", "ING",
      "Türkiye İş Bankası", "Şekerbank", "Enpara.com",
    ];
    const used = new Set(names.map((n) => motifFor(n, "BANKA")));
    // Dar bir havuz, liste satırlarının hepsinin aynı görünmesine yol açıyordu.
    expect(used.size).toBeGreaterThanOrEqual(4);
  });

  it("bilinmeyen tür için de bir motif döner", () => {
    expect(motifFor("Bir Kurum", "BILINMEYEN")).toBeTruthy();
    expect(motifFor("Bir Kurum", null)).toBeTruthy();
  });
});
