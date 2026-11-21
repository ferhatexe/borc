import { describe, it, expect } from "vitest";
import { brandFor, KNOWN_APP_STORE_IDS } from "@/lib/institutions/brand";

describe("banka logosu eşlemesi", () => {
  it("her bilinen bankanın uygulama simgesi adresi var", () => {
    for (const name of ["DenizBank", "Garanti BBVA", "QNB Finansbank", "TEB", "Şekerbank", "Vakıf Katılım", "VakıfBank", "Ziraat Katılım", "Ziraat Bankası", "ING"]) {
      expect(brandFor(name)?.appIconUrl, name).toMatch(/^\/api\/bank-icon\/\d+$/);
    }
  });

  it("katılım bankası ana bankayla karışmaz", () => {
    expect(brandFor("Vakıf Katılım")?.appIconUrl).not.toBe(brandFor("VakıfBank")?.appIconUrl);
    expect(brandFor("Ziraat Katılım")?.appIconUrl).not.toBe(brandFor("Ziraat Bankası")?.appIconUrl);
  });

  it("yönlendirme yalnız listedeki uygulamalar için", () => {
    const id = Number(brandFor("DenizBank")!.appIconUrl!.split("/").pop());
    expect(KNOWN_APP_STORE_IDS.has(id)).toBe(true);
    expect(KNOWN_APP_STORE_IDS.has(310633997)).toBe(false); // WhatsApp
  });

  it("banka olmayan kurumda logo yok", () => {
    expect(brandFor("Diğer")).toBeNull();
  });
});
