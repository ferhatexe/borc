import { describe, it, expect } from "vitest";
import { AnlikAltin21Adapter, isPlausibleGramPrice } from "@/lib/gold/anlikAltinAdapter";

/** Sayfanın gerçek yapısından alınmış kısaltılmış örnek. */
const SAYFA = `
<table><tbody>
<tr><td><a class="huge6b" href="0.01gram-21-ayar-altin-kac-tl-eder.html"
  title="0.01 gram 21 Ayar Altın = 60,24 TL">0.01 gram 21 Ayar Altın Fiyatı</a> = 60,24 TL</td><tr>
<tr><td><a class="huge6b" href="0.1gram-21-ayar-altin-kac-tl-eder.html"
  title="0.1 gram 21 Ayar Altın = 602,35 TL">0.1 gram 21 Ayar Altın Fiyatı</a> = 602,35 TL</td><tr>
<tr><td><a class="huge6b" href="0.5gram-21-ayar-altin-kac-tl-eder.html"
  title="0.5 gram 21 Ayar Altın = 3.011,77 TL">0.5 gram 21 Ayar Altın Fiyatı</a> = 3.011,77 TL</td><tr>
<tr><td><a class="huge6b" href="1gram-21-ayar-altin-kac-tl-eder.html"
  title="1 gram 21 Ayar Altın = 6.023,53 TL">1 gram 21 Ayar Altın Fiyatı</a> = 6.023,53 TL</td><tr>
<tr><td><a class="huge6b" href="1.5gram-21-ayar-altin-kac-tl-eder.html"
  title="1.5 gram 21 Ayar Altın = 9.035,30 TL">1.5 gram 21 Ayar Altın Fiyatı</a> = 9.035,30 TL</td><tr>
<tr><td><a class="huge6b" href="1000gram-21-ayar-altin-kac-tl-eder.html"
  title="1000 gram 21 Ayar Altın = 6.023.530,00 TL">1000 gram 21 Ayar Altın Fiyatı</a> = 6.023.530,00 TL</td>
</tbody></table>
`;

/** extractGramPrice private olduğu için test için erişilebilir hâle getirilir. */
const parse = (html: string): number | null =>
  (
    new AnlikAltin21Adapter() as unknown as {
      extractGramPrice(h: string): number | null;
    }
  ).extractGramPrice(html);

describe("21 ayar fiyat ayrıştırma", () => {
  it("1 gram satırını doğru okur", () => {
    expect(parse(SAYFA)).toBe(6023.53);
  });

  it("REGRESYON: '0.01 gram' satırındaki 1'i '1 gram' sanmaz", () => {
    // Çıpasız desen burada 60,24 yakalıyordu; 100 gramlık bir borçta
    // yaklaşık 600.000 TL'lik hataya yol açardı.
    expect(parse(SAYFA)).not.toBe(60.24);
    expect(parse(SAYFA)).not.toBe(602.35);
  });

  it("1000 gram satırını 1 gram sanmaz", () => {
    expect(parse(SAYFA)).not.toBe(6023530);
  });

  it("Türkçe sayı biçimini çözer (nokta binlik, virgül ondalık)", () => {
    const tek = 'title="1 gram 21 Ayar Altın = 12.345,67 TL"';
    expect(parse(tek)).toBe(12345.67);
  });

  it("noktasız küçük değerleri de okur", () => {
    expect(parse('title="1 gram 21 Ayar Altın = 999,99 TL"')).toBe(999.99);
  });

  it("eşleşme yoksa null döner, tahmin yürütmez", () => {
    expect(parse("<html><body>fiyat yok</body></html>")).toBeNull();
    expect(parse("")).toBeNull();
  });

  it("sayfa yapısı bozulursa null döner", () => {
    expect(parse('title="1 gram 21 Ayar Altın = fiyat alinamadi"')).toBeNull();
  });
});

describe("Makullük kontrolü", () => {
  const turetilmis = 6006.32;

  it("türetilmiş değere yakın fiyatı kabul eder", () => {
    expect(isPlausibleGramPrice(6023.53, turetilmis)).toBe(true);
    expect(isPlausibleGramPrice(6500, turetilmis)).toBe(true);
  });

  it("REGRESYON: bozuk kazımadan gelen küçük değeri reddeder", () => {
    expect(isPlausibleGramPrice(60.24, turetilmis)).toBe(false);
    expect(isPlausibleGramPrice(602.35, turetilmis)).toBe(false);
  });

  it("aşırı büyük değeri reddeder", () => {
    expect(isPlausibleGramPrice(6023530, turetilmis)).toBe(false);
  });

  it("geçersiz sayıları reddeder", () => {
    expect(isPlausibleGramPrice(0, turetilmis)).toBe(false);
    expect(isPlausibleGramPrice(-100, turetilmis)).toBe(false);
    expect(isPlausibleGramPrice(Number.NaN, turetilmis)).toBe(false);
    expect(isPlausibleGramPrice(6023, 0)).toBe(false);
  });

  it("tolerans sınırı ayarlanabilir", () => {
    expect(isPlausibleGramPrice(6006 * 1.2, 6006, 0.15)).toBe(false);
    expect(isPlausibleGramPrice(6006 * 1.2, 6006, 0.25)).toBe(true);
  });
});
