import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { withAmountInTitle } from "@/lib/finance/goldTitle";

const KOK = path.resolve(__dirname, "../../..");
const oku = (dosya: string) => fs.readFileSync(path.join(KOK, dosya), "utf8");

describe("Altın borcu başlığındaki miktar", () => {
  it("REGRESYON: 5 gram ödemeden sonra başlık 44 gr'da kalmaz", () => {
    expect(withAmountInTitle("21 Ayar Halep Zinciri (44 gr) - Feyzi Şimşek", 39)).toBe(
      "21 Ayar Halep Zinciri (39 gr) - Feyzi Şimşek"
    );
  });

  it("kesirli gramı Türkçe yazar, adet birimini korur", () => {
    expect(withAmountInTitle("Bilezik (20 gr)", 17.5)).toBe("Bilezik (17,5 gr)");
    expect(withAmountInTitle("Tam Altın (2 Adet) - Bahar", 1)).toBe("Tam Altın (1 Adet) - Bahar");
  });

  it("başlıkta miktar yoksa dokunmaz", () => {
    expect(withAmountInTitle("Bahar'a altın borcu", 3)).toBe("Bahar'a altın borcu");
  });

  it("ödeme gram düşünce başlığı da günceller", () => {
    const s = oku("src/lib/db/debts.ts");
    expect(s).toContain("debtUpdate.title = title");
  });
});

describe("Ayarlar'daki altın marjı", () => {
  it("REGRESYON: marj değişince primi eski marjda duran borçlar da güncellenir", () => {
    // Borç formu marjı prime kopyalıyor, değerleme primi öne alıyor; Ayarlar'daki
    // değişiklik borca ulaşmıyordu (21 ayar 200 -> 102, borç 200'de kaldı).
    const route = oku("src/app/api/settings/route.ts");
    expect(route).toContain("syncGoldDebtPremiums(");
    const lib = oku("src/lib/db/settings.ts");
    expect(lib).toMatch(/premiumTL: prev \}/);
  });
});
