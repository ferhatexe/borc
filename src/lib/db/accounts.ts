import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ConflictError, NotFoundError } from "./debts";

/**
 * Hesap kurulumu ve şifre.
 *
 * Uygulamada açık kayıt yok (internete açık bir kasa). Yeni hesabı sahibi
 * açar; yeni kullanıcı şifresini kimseyle paylaşmadan, tek kullanımlık bir
 * kurulum bağlantısıyla kendisi belirler. Bağlantıdaki belirteç veritabanında
 * yalnızca özet (sha256) olarak durur ve kullanılınca silinir.
 */
export const SETUP_KEY = "password_setup";
export const MIN_PASSWORD_LENGTH = 8;

const sha256 = (text: string) => crypto.createHash("sha256").update(text).digest("hex");

/** "<userId>.<rastgele>" biçiminde belirteç döner; süresi `days` gün. */
export async function createSetupToken(userId: string, days = 7): Promise<string> {
  const secret = crypto.randomBytes(24).toString("base64url");
  const value = { hash: sha256(secret), expiresAt: new Date(Date.now() + days * 86_400_000).toISOString() };
  await prisma.setting.upsert({
    where: { userId_key: { userId, key: SETUP_KEY } },
    update: { value },
    create: { userId, key: SETUP_KEY, value },
  });
  return `${userId}.${secret}`;
}

/** Belirteci doğrular, şifreyi yazar, belirteci siler. Geçersizse ConflictError. */
export async function completeSetup(token: string, password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ConflictError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
  }
  const dot = token.indexOf(".");
  const userId = dot > 0 ? token.slice(0, dot) : "";
  const secret = dot > 0 ? token.slice(dot + 1) : "";
  const invalid = new ConflictError("Kurulum bağlantısı geçersiz ya da süresi dolmuş.");
  if (!userId || !secret) throw invalid;

  const row = await prisma.setting.findUnique({ where: { userId_key: { userId, key: SETUP_KEY } } });
  const value = row?.value as { hash?: string; expiresAt?: string } | null;
  if (!value?.hash || !value.expiresAt || new Date(value.expiresAt) < new Date()) throw invalid;
  const a = Buffer.from(sha256(secret), "hex");
  const b = Buffer.from(value.hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw invalid;

  const passwordHash = await hashPassword(password);
  const [user] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.setting.delete({ where: { userId_key: { userId, key: SETUP_KEY } } }),
  ]);
  return user;
}

/** Oturumdaki kullanıcının şifresini değiştirir. */
export async function changePassword(userId: string, current: string, next: string) {
  if (next.length < MIN_PASSWORD_LENGTH) {
    throw new ConflictError(`Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new NotFoundError("Kullanıcı bulunamadı");
  if (!(await verifyPassword(current, user.passwordHash))) {
    throw new ConflictError("Mevcut şifre hatalı.");
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
}

/** Kaynak kullanıcının gelir/gider kategorilerini (alt kategorileriyle) kopyalar. */
export async function copyCategories(fromUserId: string, toUserId: string): Promise<number> {
  const source = await prisma.category.findMany({
    where: { userId: fromUserId },
    orderBy: { name: "asc" },
  });
  const existing = await prisma.category.count({ where: { userId: toUserId } });
  if (existing > 0) return 0;

  const idMap = new Map<string, string>();
  let count = 0;
  // Önce üst kategoriler, sonra alt kategoriler (parentId eşlemesi için).
  for (const pass of [false, true]) {
    for (const c of source.filter((x) => Boolean(x.parentId) === pass)) {
      const created = await prisma.category.create({
        data: {
          userId: toUserId,
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color,
          isSystem: c.isSystem,
          parentId: c.parentId ? (idMap.get(c.parentId) ?? null) : null,
        },
      });
      idMap.set(c.id, created.id);
      count++;
    }
  }
  return count;
}
