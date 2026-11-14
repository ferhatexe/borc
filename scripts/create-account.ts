/**
 * Yeni hesap açar ve tek kullanımlık kurulum bağlantısı üretir.
 *
 *   npx tsx --env-file=.env scripts/create-account.ts <e-posta> "<Ad>" <bağlantı-dosyası> [--kumar-serisi]
 *
 * Şifre bu betikte belirlenmez: hesap kullanılamaz bir şifreyle açılır, sahibi
 * bağlantıyı yeni kullanıcıya iletir, o da /hesap-kur sayfasında kendi şifresini
 * koyar. Bağlantı 7 gün geçerli ve tek kullanımlık; dosyaya yazılır, ekrana basılmaz.
 * Kategoriler ilk kullanıcıdan kopyalanır; kumar serisi varsayılan olarak kapalıdır.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { copyCategories, createSetupToken } from "../src/lib/db/accounts";
import { ensureDefaultSettings, getSettings, updateSetting } from "../src/lib/db/settings";
import { SETTING_KEYS } from "../src/lib/settings/defaults";

const BASE_URL = process.env.APP_BASE_URL ?? "https://borc-omega.vercel.app";

async function main() {
  const [emailArg, name, outFile] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !outFile) {
    throw new Error('Kullanım: create-account.ts <e-posta> "<Ad>" <bağlantı-dosyası> [--kumar-serisi]');
  }
  const coach = process.argv.includes("--kumar-serisi");

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Kimsenin bilmediği rastgele şifre: kurulum yapılana kadar giriş yapılamaz.
    const unusable = await hashPassword(crypto.randomBytes(32).toString("hex"));
    user = await prisma.user.create({ data: { email, name: name || null, passwordHash: unusable, currency: "TRY" } });
    console.log("hesap açıldı:", email);
  } else {
    console.log("hesap zaten var, yalnız yeni kurulum bağlantısı üretiliyor:", email);
  }

  const owner = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (owner && owner.id !== user.id) {
    console.log("kopyalanan kategori:", await copyCategories(owner.id, user.id));
  }

  await ensureDefaultSettings(user.id);
  const s = await getSettings(user.id);
  await updateSetting(user.id, SETTING_KEYS.APP_PREFERENCES, { ...s.appPreferences, theme: "light", gamblingCoach: coach });

  const token = await createSetupToken(user.id, 7);
  fs.writeFileSync(outFile, `${BASE_URL}/hesap-kur?t=${encodeURIComponent(token)}\n`, { mode: 0o600 });
  console.log(`kurulum bağlantısı (7 gün, tek kullanım) dosyaya yazıldı: ${outFile} | kumar serisi: ${coach ? "açık" : "kapalı"}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
