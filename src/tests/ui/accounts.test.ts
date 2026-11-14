import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_APP_PREFERENCES } from "@/lib/settings/defaults";
import { appPreferencesSchema } from "@/lib/validation/settings";

const KOK = path.resolve(__dirname, "../../..");
const oku = (f: string) => fs.readFileSync(path.join(KOK, f), "utf8");

describe("Hesap kurulumu", () => {
  it("kurulum sayfası ve API'si oturumsuz açılır, başka bir şey açılmaz", () => {
    const proxy = oku("src/proxy.ts");
    expect(proxy).toContain(`"/hesap-kur"`);
    expect(proxy).toContain(`"/api/auth/setup"`);
    expect(proxy).not.toContain(`"/api/auth/password"`);
  });

  it("kurulum belirteci veritabanında özet olarak durur, kullanılınca silinir", () => {
    const lib = oku("src/lib/db/accounts.ts");
    expect(lib).toMatch(/hash: sha256\(secret\)/);
    expect(lib).toContain("timingSafeEqual");
    expect(lib).toMatch(/prisma\.setting\.delete\(\{ where: \{ userId_key: \{ userId, key: SETUP_KEY \} \} \}\)/);
  });

  it("hesap açma betiği şifreyi ekrana basmaz, bağlantıyı dosyaya yazar", () => {
    const script = oku("scripts/create-account.ts");
    expect(script).toContain("writeFileSync(outFile");
    expect(script).not.toMatch(/console\.log\([^)]*token/);
  });
});

describe("Kumarsız gün serisi hesap ayarı", () => {
  it("varsayılan açık; eski kayıtlarda alan yoksa açık sayılır", () => {
    expect(DEFAULT_APP_PREFERENCES.gamblingCoach).toBe(true);
    expect(appPreferencesSchema.parse({ currency: "TRY", theme: "light", locale: "tr-TR" }).gamblingCoach).toBe(true);
    expect(appPreferencesSchema.parse({ currency: "TRY", theme: "light", locale: "tr-TR", gamblingCoach: false }).gamblingCoach).toBe(false);
  });

  it("kapalı hesapta ana sayfa seri kartını çizmez", () => {
    expect(oku("src/app/page.tsx")).toMatch(/coachOn \? buildStreakView/);
    expect(oku("src/components/dashboard/DashboardClient.tsx")).toContain("{streak && <CoachCard");
  });
});
