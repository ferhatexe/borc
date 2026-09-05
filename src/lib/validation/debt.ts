import { z } from "zod";

/**
 * One schema shared by the wizard forms and the API routes, so a payload that
 * passes client validation cannot be rejected by a different rule on the server.
 */

export const DEBT_TYPES = [
  "TAKSITLI_KREDI",
  "KREDI_KARTI",
  "EK_HESAP_KMH",
  "ALTIN_BORCU",
  "KISI_BORCU",
  "SENET_CEK",
  "DUZENLI_ODEME",
  "DIGER",
] as const;

export const GOLD_TYPE_VALUES = [
  "GRAM_ALTIN",
  "CEYREK",
  "YARIM",
  "TAM",
  "ATA",
  "GREMSE",
  "BILEZIK_22",
  "ZINCIR_21_HALEP",
  "BILEZIK_14",
  "BILEZIK_18",
  "KULCE",
  "DIGER",
] as const;

export const PAYMENT_METHODS = [
  "NAKIT",
  "HAVALE",
  "KART",
  "BANKA_KARTI",
  "KREDI_KARTI",
  "OTOMATIK_ODEME",
  "DIGER",
] as const;

/** Accepts numbers and numeric strings; rejects NaN/Infinity. Keeps 0. */
const money = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} sayısal olmalıdır` })
    .finite(`${label} geçerli bir sayı olmalıdır`)
    .min(0, `${label} negatif olamaz`);

const optionalMoney = (label: string) => money(label).optional().nullable();

/** Monthly interest as a percent, e.g. 3.89. Bounded to catch typos. */
const ratePercent = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} sayısal olmalıdır` })
    .finite()
    .min(0, `${label} negatif olamaz`)
    .max(100, `${label} aylık %100'den büyük olamaz`);

/** Tax rate as a fraction, e.g. 0.15. */
const rateFraction = (label: string) =>
  z.coerce.number().finite().min(0, `${label} negatif olamaz`).max(1, `${label} en fazla 1 olabilir`);

const isoDate = (label: string) =>
  z
    .union([z.string(), z.date()])
    .refine((v) => !Number.isNaN(new Date(v).getTime()), `${label} geçerli bir tarih olmalıdır`)
    .transform((v) => new Date(v));

const optionalIsoDate = (label: string) => isoDate(label).optional().nullable();

const dayOfMonth = (label: string) =>
  z.coerce.number().int(`${label} tam sayı olmalıdır`).min(1, `${label} 1-31 arası olmalıdır`).max(31, `${label} 1-31 arası olmalıdır`);

export const cardInstallmentSchema = z.object({
  description: z.string().trim().min(1, "Açıklama zorunludur").max(120),
  totalAmount: money("Toplam tutar"),
  installmentCount: z.coerce.number().int().min(1).max(360),
  remainingInstallments: z.coerce.number().int().min(0).max(360),
  monthlyAmount: money("Aylık tutar"),
});
export type CardInstallment = z.infer<typeof cardInstallmentSchema>;

export const personalInstallmentPlanSchema = z.object({
  installmentCount: z.coerce.number().int().min(1).max(360),
  installmentAmount: money("Taksit tutarı"),
  firstPaymentDate: optionalIsoDate("İlk ödeme tarihi"),
});

const baseDebtSchema = z.object({
  type: z.enum(DEBT_TYPES, { required_error: "Borç türü zorunludur" }),
  title: z.string().trim().min(1, "Borç başlığı zorunludur").max(160),
  institutionId: z.string().trim().min(1).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  color: z.string().trim().max(32).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  currency: z.enum(["TRY", "USD", "EUR", "XAU"]).default("TRY"),
  startDate: isoDate("Başlangıç tarihi").default(() => new Date()),

  // TAKSITLI_KREDI
  loanSubType: z.enum(["IHTIYAC", "TASIT", "KONUT", "EGITIM", "KOBI"]).optional().nullable(),
  principal: optionalMoney("Anapara"),
  interestRateMonthly: ratePercent("Aylık faiz oranı").optional().nullable(),
  installmentCount: z.coerce.number().int().min(1).max(480).optional().nullable(),
  /**
   * Krediyi ortasından ekleyenler için: baştan kaç taksit zaten ödendi.
   * Kullanıcı krediyi bankadaki hâliyle (toplam anapara + toplam taksit)
   * girer, uygulama ilk N taksiti ödenmiş işaretler.
   */
  paidInstallments: z.coerce.number().int().min(0).max(480).optional().nullable(),
  installmentAmount: optionalMoney("Taksit tutarı"),
  firstPaymentDate: optionalIsoDate("İlk taksit tarihi"),
  paymentDayOfMonth: dayOfMonth("Ödeme günü").optional().nullable(),
  includeKKDF: z.coerce.boolean().optional(),
  kkdfRate: rateFraction("KKDF oranı").optional().nullable(),
  includeBSMV: z.coerce.boolean().optional(),
  bsmvRate: rateFraction("BSMV oranı").optional().nullable(),
  earlyPayoffEnabled: z.coerce.boolean().optional(),
  loanAccountNo: z.string().trim().max(64).optional().nullable(),
  /**
   * Bankadaki güncel kalan anapara. Verilirse amortisman tablosundan
   * hesaplanan bakiyenin yerine geçer.
   */
  currentPrincipalOverride: optionalMoney("Güncel kalan anapara"),

  // KREDI_KARTI
  cardName: z.string().trim().max(120).optional().nullable(),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Son 4 hane 4 rakam olmalıdır")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  creditLimit: optionalMoney("Kart limiti"),
  currentStatementBalance: optionalMoney("Dönem borcu"),
  minimumPayment: optionalMoney("Asgari ödeme"),
  statementDay: dayOfMonth("Hesap kesim günü").optional().nullable(),
  dueDay: dayOfMonth("Son ödeme günü").optional().nullable(),
  contractualInterestMonthly: ratePercent("Akdi faiz").optional().nullable(),
  overdueInterestMonthly: ratePercent("Gecikme faizi").optional().nullable(),
  installmentsOnCard: z.array(cardInstallmentSchema).max(60).optional().nullable(),

  // EK_HESAP_KMH
  limit: optionalMoney("KMH limiti"),
  usedAmount: optionalMoney("Kullanılan bakiye"),
  lastInterestChargeDate: optionalIsoDate("Son faiz tahakkuk tarihi"),
  accrualBasis: z.enum(["GUNLUK"]).optional().nullable(),

  // ALTIN_BORCU
  goldType: z.enum(GOLD_TYPE_VALUES).optional().nullable(),
  quantity: optionalMoney("Adet"),
  grams: optionalMoney("Gram"),
  karat: z.coerce.number().int().refine((v) => [14, 18, 21, 22, 24].includes(v), "Ayar 14/18/21/22/24 olmalıdır").optional().nullable(),
  priceSource: z.enum(["CANLI", "MANUEL"]).optional().nullable(),
  manualUnitPrice: optionalMoney("Manuel birim fiyat"),
  premiumTL: optionalMoney("Marj (TL)"),
  creditorName: z.string().trim().max(160).optional().nullable(),
  dueDate: optionalIsoDate("Vade tarihi"),
  isInterestFree: z.coerce.boolean().optional(),

  // KISI_BORCU
  creditorPhone: z.string().trim().max(32).optional().nullable(),
  amount: optionalMoney("Tutar"),
  hasInterest: z.coerce.boolean().optional(),
  installmentPlan: personalInstallmentPlanSchema.optional().nullable(),

  // SENET_CEK
  documentType: z.enum(["SENET", "CEK"]).optional().nullable(),
  documentNo: z.string().trim().max(64).optional().nullable(),
  drawee: z.string().trim().max(160).optional().nullable(),

  // DUZENLI_ODEME
  frequency: z.enum(["AYLIK", "UC_AYLIK", "ALTI_AYLIK", "YILLIK"]).optional().nullable(),
  nextDueDate: optionalIsoDate("Sonraki ödeme tarihi"),
  autoCreateExpense: z.coerce.boolean().optional(),
});

/** Per-type required fields, applied on top of the permissive base shape. */
export const createDebtSchema = baseDebtSchema.superRefine((data, ctx) => {
  const require = (field: keyof typeof data, message: string) => {
    const value = data[field];
    if (value === undefined || value === null || value === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field as string], message });
    }
  };

  switch (data.type) {
    case "TAKSITLI_KREDI": {
      require("principal", "Kredi anaparası zorunludur");
      require("installmentCount", "Taksit sayısı zorunludur");
      require("interestRateMonthly", "Aylık faiz oranı zorunludur");
      require("firstPaymentDate", "İlk taksit vade tarihi zorunludur");
      if (data.principal !== undefined && data.principal !== null && data.principal <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["principal"], message: "Anapara 0'dan büyük olmalıdır" });
      }
      if (
        data.paidInstallments != null &&
        data.installmentCount != null &&
        data.paidInstallments >= data.installmentCount
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paidInstallments"],
          message: "Ödenen taksit sayısı, toplam taksit sayısından az olmalıdır",
        });
      }
      break;
    }

    case "KREDI_KARTI":
      require("creditLimit", "Kart limiti zorunludur");
      require("statementDay", "Hesap kesim günü zorunludur");
      require("dueDay", "Son ödeme günü zorunludur");
      break;

    case "EK_HESAP_KMH":
      require("limit", "KMH limiti zorunludur");
      require("usedAmount", "Kullanılan bakiye zorunludur");
      require("interestRateMonthly", "Aylık faiz oranı zorunludur");
      break;

    case "ALTIN_BORCU": {
      require("goldType", "Altın türü zorunludur");
      const hasQty = (data.quantity ?? 0) > 0;
      const hasGrams = (data.grams ?? 0) > 0;
      if (!hasQty && !hasGrams) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantity"],
          message: "Adet veya gram bilgisinden en az biri girilmelidir",
        });
      }
      if (data.priceSource === "MANUEL" && !(data.manualUnitPrice && data.manualUnitPrice > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["manualUnitPrice"],
          message: "Manuel fiyat seçildiğinde birim fiyat zorunludur",
        });
      }
      break;
    }

    case "KISI_BORCU":
      require("creditorName", "Alacaklı adı zorunludur");
      require("amount", "Borç tutarı zorunludur");
      if (data.hasInterest && !(data.interestRateMonthly && data.interestRateMonthly > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["interestRateMonthly"],
          message: "Faizli seçildiğinde aylık faiz oranı zorunludur",
        });
      }
      break;

    case "SENET_CEK":
      require("documentType", "Belge türü zorunludur");
      require("amount", "Tutar zorunludur");
      require("dueDate", "Vade tarihi zorunludur");
      break;

    case "DUZENLI_ODEME":
      require("amount", "Tutar zorunludur");
      require("frequency", "Ödeme sıklığı zorunludur");
      require("nextDueDate", "Sonraki ödeme tarihi zorunludur");
      break;

    case "DIGER":
      require("amount", "Tutar zorunludur");
      break;
  }
});

export type CreateDebtInput = z.infer<typeof createDebtSchema>;

export const updateDebtSchema = baseDebtSchema.partial().extend({
  status: z.enum(["AKTIF", "KAPANDI", "GECIKMIS", "ERTELENDI"]).optional(),
});
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;

export const payInstallmentSchema = z.object({
  installmentId: z.string().trim().min(1).optional().nullable(),
  amount: money("Ödeme tutarı").refine((v) => v > 0, "Ödeme tutarı 0'dan büyük olmalıdır"),
  paidAt: optionalIsoDate("Ödeme tarihi"),
  method: z.enum(PAYMENT_METHODS).default("HAVALE"),
  note: z.string().trim().max(500).optional().nullable(),
  /** Also write a matching expense record (şartname §6.2). */
  createExpense: z.coerce.boolean().default(true),
  expenseCategoryId: z.string().trim().min(1).optional().nullable(),
});
export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;
