import { prisma } from "@/lib/prisma";
import {
  AppSettings,
  DEFAULT_SETTINGS,
  DEFAULT_SETTING_VALUES,
  SETTING_KEYS,
  SettingKey,
} from "@/lib/settings/defaults";

/**
 * Settings are read on almost every request, so they are cached per user for a
 * short window. Any write invalidates the entry immediately.
 */
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map<string, { value: AppSettings; expiresAt: number }>();

export function invalidateSettingsCache(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

/** Shallow merge of a stored JSON value over its shipped default. */
function mergeObject<T>(fallback: T, stored: unknown): T {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return fallback;
  return { ...(fallback as object), ...(stored as object) } as T;
}

/**
 * Reads every setting for a user from the database. Missing keys fall back to
 * the shipped defaults, so a fresh database still behaves correctly.
 */
export async function getSettings(userId: string): Promise<AppSettings> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const rows = await prisma.setting.findMany({ where: { userId } });
  const byKey = new Map(rows.map((r) => [r.key, r.value as unknown]));

  const settings: AppSettings = {
    taxRates: mergeObject(DEFAULT_SETTINGS.taxRates, byKey.get(SETTING_KEYS.TAX_RATES)),
    goldMargins: mergeObject(DEFAULT_SETTINGS.goldMargins, byKey.get(SETTING_KEYS.GOLD_MARGINS)),
    goldMillesimal: mergeObject(
      DEFAULT_SETTINGS.goldMillesimal,
      byKey.get(SETTING_KEYS.GOLD_KARAT_MILLESIMAL)
    ),
    goldUnitGrams: mergeObject(
      DEFAULT_SETTINGS.goldUnitGrams,
      byKey.get(SETTING_KEYS.GOLD_UNIT_GRAMS)
    ),
    goldManualPrices: mergeObject(
      DEFAULT_SETTINGS.goldManualPrices,
      byKey.get(SETTING_KEYS.GOLD_MANUAL_PRICES)
    ),
    appPreferences: mergeObject(
      DEFAULT_SETTINGS.appPreferences,
      byKey.get(SETTING_KEYS.APP_PREFERENCES)
    ),
  };

  cache.set(userId, { value: settings, expiresAt: Date.now() + CACHE_TTL_MS });
  return settings;
}

/**
 * Settings for background jobs that have no user context (gold cron).
 * Uses the first user in the database, which is the single app owner.
 */
export async function getSettingsForOwner(): Promise<AppSettings> {
  const owner = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!owner) return DEFAULT_SETTINGS;
  return getSettings(owner.id);
}

export async function getRawSettings(userId: string): Promise<Record<string, unknown>> {
  const rows = await prisma.setting.findMany({ where: { userId } });
  const byKey: Record<string, unknown> = { ...DEFAULT_SETTING_VALUES };
  for (const row of rows) byKey[row.key] = row.value as unknown;
  return byKey;
}

/** Replaces one setting key. The caller is responsible for validating `value`. */
export async function updateSetting(userId: string, key: SettingKey, value: unknown) {
  const saved = await prisma.setting.upsert({
    where: { userId_key: { userId, key } },
    update: { value: value as never },
    create: { userId, key, value: value as never },
  });
  invalidateSettingsCache(userId);
  return saved;
}

/** Ensures every default key exists for a user (called after login / first run). */
export async function ensureDefaultSettings(userId: string) {
  const existing = await prisma.setting.findMany({
    where: { userId },
    select: { key: true },
  });
  const have = new Set(existing.map((e) => e.key));
  const missing = (Object.keys(DEFAULT_SETTING_VALUES) as SettingKey[]).filter((k) => !have.has(k));
  if (missing.length === 0) return;

  await prisma.setting.createMany({
    data: missing.map((key) => ({ userId, key, value: DEFAULT_SETTING_VALUES[key] as never })),
    skipDuplicates: true,
  });
  invalidateSettingsCache(userId);
}
