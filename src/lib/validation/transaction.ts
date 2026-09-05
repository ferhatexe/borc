import { z } from "zod";
import { PAYMENT_METHODS } from "./debt";

const money = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} sayısal olmalıdır` })
    .finite(`${label} geçerli bir sayı olmalıdır`)
    .gt(0, `${label} 0'dan büyük olmalıdır`);

const isoDate = (label: string) =>
  z
    .union([z.string(), z.date()])
    .refine((v) => !Number.isNaN(new Date(v).getTime()), `${label} geçerli bir tarih olmalıdır`)
    .transform((v) => new Date(v));

export const createIncomeSchema = z.object({
  categoryId: z.string().trim().min(1, "Kategori seçimi zorunludur"),
  amount: money("Tutar"),
  currency: z.enum(["TRY", "USD", "EUR", "XAU"]).default("TRY"),
  date: isoDate("Tarih").default(() => new Date()),
  source: z.string().trim().min(1, "Gelir kaynağı zorunludur").max(160),
  isRecurring: z.coerce.boolean().default(false),
  recurrenceRule: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});
export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;

export const createExpenseSchema = z.object({
  categoryId: z.string().trim().min(1, "Kategori seçimi zorunludur"),
  subcategoryId: z.string().trim().min(1).optional().nullable(),
  amount: money("Tutar"),
  currency: z.enum(["TRY", "USD", "EUR", "XAU"]).default("TRY"),
  date: isoDate("Tarih").default(() => new Date()),
  merchant: z.string().trim().max(160).optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).default("KART"),
  relatedDebtId: z.string().trim().min(1).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Kategori adı zorunludur").max(80),
  type: z.enum(["GELIR", "GIDER"], { required_error: "Kategori türü zorunludur" }),
  icon: z.string().trim().max(40).optional().nullable(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB biçiminde olmalıdır")
    .optional()
    .nullable(),
  parentId: z.string().trim().min(1).optional().nullable(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const createInstitutionSchema = z.object({
  name: z.string().trim().min(2, "Kurum adı en az 2 karakter olmalıdır").max(120),
  type: z.enum(["BANKA", "KATILIM", "FINANSMAN", "KISI", "KURUM", "DIGER"]).default("BANKA"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB biçiminde olmalıdır")
    .optional()
    .nullable(),
});
export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;

/** Query params shared by the income and expense list endpoints. */
export const listFilterSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  categoryId: z.string().trim().min(1).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  from: z
    .union([z.string(), z.date()])
    .refine((v) => !Number.isNaN(new Date(v).getTime()))
    .transform((v) => new Date(v))
    .optional(),
  to: z
    .union([z.string(), z.date()])
    .refine((v) => !Number.isNaN(new Date(v).getTime()))
    .transform((v) => new Date(v))
    .optional(),
});
export type ListFilter = z.infer<typeof listFilterSchema>;
