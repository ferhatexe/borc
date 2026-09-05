import { z } from "zod";
import { GOLD_TYPE_VALUES } from "./debt";

const fraction = (label: string) =>
  z.coerce.number().finite().min(0, `${label} negatif olamaz`).max(1, `${label} en fazla 1 (%100) olabilir`);

const tlAmount = (label: string) =>
  z.coerce.number().finite().min(0, `${label} negatif olamaz`).max(10_000_000, `${label} çok büyük`);

export const taxRatesSchema = z.object({
  kkdfRate: fraction("KKDF oranı"),
  bsmvRate: fraction("BSMV oranı"),
  earlyPayoffPenaltyRate: fraction("Erken kapama komisyon oranı"),
  creditCardMinPaymentRate: fraction("Asgari ödeme oranı"),
});

export const goldMarginsSchema = z.record(z.enum(GOLD_TYPE_VALUES), tlAmount("Marj"));

export const goldMillesimalSchema = z.record(
  z.enum(["14", "18", "21", "22", "24"]),
  z.coerce.number().int().min(1, "Milyem 1-1000 arası olmalıdır").max(1000, "Milyem 1-1000 arası olmalıdır")
);

export const goldUnitGramsSchema = z.record(
  z.enum(GOLD_TYPE_VALUES),
  z.coerce.number().finite().gt(0, "Gram ağırlığı 0'dan büyük olmalıdır").max(1000)
);

export const goldManualPricesSchema = z.object({
  enabled: z.coerce.boolean(),
  pureGramSellTL: z.coerce.number().finite().min(0),
  prices: z.record(z.enum(GOLD_TYPE_VALUES), z.coerce.number().finite().min(0)).default({}),
  updatedAt: z.string().nullable().optional(),
});

export const appPreferencesSchema = z.object({
  currency: z.enum(["TRY", "USD", "EUR"]),
  theme: z.enum(["dark", "light"]),
  locale: z.string().trim().min(2).max(10),
});

/** Maps a setting key to the schema that guards it. */
export const SETTING_SCHEMAS = {
  tax_rates: taxRatesSchema,
  gold_margins: goldMarginsSchema,
  gold_karat_millesimal: goldMillesimalSchema,
  gold_unit_grams: goldUnitGramsSchema,
  gold_manual_prices: goldManualPricesSchema,
  app_preferences: appPreferencesSchema,
} as const;

export const updateSettingsSchema = z
  .object({
    tax_rates: taxRatesSchema.optional(),
    gold_margins: goldMarginsSchema.optional(),
    gold_karat_millesimal: goldMillesimalSchema.optional(),
    gold_unit_grams: goldUnitGramsSchema.optional(),
    gold_manual_prices: goldManualPricesSchema.optional(),
    app_preferences: appPreferencesSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Güncellenecek en az bir ayar gönderilmelidir");

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** Shape of the JSON backup file produced by /api/reports/backup. */
export const backupRestoreSchema = z.object({
  meta: z
    .object({
      version: z.string().optional(),
      exportedAt: z.string().optional(),
      app: z.string().optional(),
    })
    .optional(),
  institutions: z.array(z.record(z.string(), z.unknown())).default([]),
  categories: z.array(z.record(z.string(), z.unknown())).default([]),
  debts: z.array(z.record(z.string(), z.unknown())).default([]),
  incomes: z.array(z.record(z.string(), z.unknown())).default([]),
  expenses: z.array(z.record(z.string(), z.unknown())).default([]),
  settings: z.array(z.record(z.string(), z.unknown())).default([]),
});
export type BackupPayload = z.infer<typeof backupRestoreSchema>;
