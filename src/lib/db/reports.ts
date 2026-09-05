import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { tr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getDebts } from "./debts";
import { getIncomes, getExpenses } from "./transactions";
import { getCategories } from "./categories";
import { getInstitutions } from "./institutions";
import { getRawSettings, getSettings } from "./settings";
import { getGoldPrices } from "../gold/goldService";
import type { GoldSyncResult } from "../gold/types";
import { buildPortfolioSummary, type InstitutionBreakdown } from "../finance/debtValuation";
import { formatDateTR } from "../formatters";

const DEBT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  TAKSITLI_KREDI: { label: "Taksitli Kredi", color: "#10b981" },
  KREDI_KARTI: { label: "Kredi Kartı", color: "#6366f1" },
  EK_HESAP_KMH: { label: "KMH / Ek Hesap", color: "#f59e0b" },
  ALTIN_BORCU: { label: "Altın Borcu", color: "#eab308" },
  KISI_BORCU: { label: "Kişi Borcu", color: "#ec4899" },
  SENET_CEK: { label: "Senet / Çek", color: "#8b5cf6" },
  DUZENLI_ODEME: { label: "Düzenli Ödeme", color: "#14b8a6" },
  DIGER: { label: "Diğer", color: "#71717a" },
};

const EXPENSE_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#a855f7",
];

export interface CategoryBreakdownRow {
  categoryId: string;
  categoryName: string;
  amountTL: number;
  percentage: number;
  color: string;
}

export interface AnalyticsSummary {
  totalDebtTL: number;
  totalAccruedInterestTL: number;
  dueThisMonthTL: number;
  overdueTL: number;
  totalMonthlyIncomeTL: number;
  totalMonthlyExpenseTL: number;
  netCashFlowTL: number;
  debtTypeBreakdown: Array<{
    type: string;
    label: string;
    amountTL: number;
    percentage: number;
    color: string;
  }>;
  expenseCategoryBreakdown: CategoryBreakdownRow[];
  incomeCategoryBreakdown: CategoryBreakdownRow[];
  institutionBreakdown: InstitutionBreakdown[];
  monthlyProjection12Months: Array<{
    monthIndex: number;
    monthName: string;
    scheduledRemainingTL: number;
    revolvingRemainingTL: number;
    remainingDebtTL: number;
    monthlyPaymentTL: number;
  }>;
  cashFlowHistory: Array<{
    monthLabel: string;
    incomeTL: number;
    expenseTL: number;
    netTL: number;
  }>;
  goldStatus: {
    source: string;
    sourceKind: string;
    fetchedAt: string | null;
    warning: string | null;
    pureGramSellTL: number;
  } | null;
  /** Estimated debt-free date from the scheduled plans, null when unknown. */
  projectedDebtFreeDate: string | null;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : 0;
}

function round(value: number): number {
  return Math.round(value);
}

export async function getAnalyticsSummary(userId: string, now = new Date()): Promise<AnalyticsSummary> {
  // 12 months of history plus the current month, fetched in one window.
  const historyStart = startOfMonth(subMonths(now, 11));
  const historyEnd = endOfMonth(now);

  let gold: GoldSyncResult | null = null;
  const [debts, incomes, expenses, categories, settings] = await Promise.all([
    getDebts(userId),
    getIncomes(userId, { from: historyStart, to: historyEnd }),
    getExpenses(userId, { from: historyStart, to: historyEnd }),
    getCategories(userId),
    getSettings(userId),
  ]);

  try {
    gold = await getGoldPrices();
  } catch {
    gold = null; // the UI shows the warning band; nothing is invented here
  }

  const portfolio = buildPortfolioSummary(debts, gold, settings, now);

  const debtTypeMap = new Map<string, number>();
  for (const v of portfolio.valuations) {
    debtTypeMap.set(v.type, (debtTypeMap.get(v.type) ?? 0) + v.outstandingTL);
  }

  const debtTypeBreakdown = Array.from(debtTypeMap.entries())
    .map(([type, amountTL]) => {
      const meta = DEBT_TYPE_LABELS[type] ?? { label: type, color: "#71717a" };
      return {
        type,
        label: meta.label,
        amountTL: round(amountTL),
        percentage: pct(amountTL, portfolio.totalDebtTL),
        color: meta.color,
      };
    })
    .sort((a, b) => b.amountTL - a.amountTL);

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const inRange = (d: Date | string) => {
    const date = new Date(d);
    return date >= monthStart && date <= monthEnd;
  };

  const thisMonthIncomes = incomes.filter((i) => inRange(i.date));
  const thisMonthExpenses = expenses.filter((e) => inRange(e.date));

  const totalMonthlyIncomeTL = thisMonthIncomes.reduce((s, i) => s + Number(i.amount), 0);
  const totalMonthlyExpenseTL = thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const categoryLookup = new Map(categories.map((c) => [c.id, c]));

  const buildCategoryBreakdown = (
    rows: Array<{ categoryId: string; amount: unknown }>,
    total: number,
    fallbackName: string,
    usePalette: boolean
  ): CategoryBreakdownRow[] => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.categoryId, (map.get(row.categoryId) ?? 0) + Number(row.amount));
    }
    let idx = 0;
    return Array.from(map.entries())
      .map(([categoryId, amountTL]) => {
        const cat = categoryLookup.get(categoryId);
        return {
          categoryId,
          categoryName: cat?.name ?? fallbackName,
          amountTL: round(amountTL),
          percentage: pct(amountTL, total),
          color:
            cat?.color ??
            (usePalette ? EXPENSE_PALETTE[idx++ % EXPENSE_PALETTE.length] : "#10b981"),
        };
      })
      .sort((a, b) => b.amountTL - a.amountTL);
  };

  const expenseCategoryBreakdown = buildCategoryBreakdown(
    thisMonthExpenses,
    totalMonthlyExpenseTL,
    "Sınıflandırılmamış",
    true
  );
  const incomeCategoryBreakdown = buildCategoryBreakdown(
    thisMonthIncomes,
    totalMonthlyIncomeTL,
    "Sınıflandırılmamış",
    false
  );

  // --- 12 month debt projection -------------------------------------------
  // Only scheduled instalment plans amortise. Revolving balances (KMH, cards)
  // and open-ended debts are carried FLAT and reported separately, rather than
  // melted away with an invented decay factor.
  const loans = debts.filter(
    (d) => d.type === "TAKSITLI_KREDI" && (d.installmentSchedules?.length ?? 0) > 0
  );
  const revolvingTL = portfolio.valuations
    .filter((v) => v.type !== "TAKSITLI_KREDI")
    .reduce((sum, v) => sum + v.outstandingTL, 0);

  const monthlyProjection12Months: AnalyticsSummary["monthlyProjection12Months"] = [];
  let projectedDebtFreeDate: string | null = null;

  for (let i = 0; i < 12; i++) {
    const target = addMonths(monthStart, i);
    const targetEnd = endOfMonth(target);

    let scheduledRemaining = 0;
    let monthlyPayment = 0;

    for (const loan of loans) {
      const rows = loan.installmentSchedules;
      const stillOpen = rows.filter(
        (s) => s.status !== "ODENDI" && new Date(s.dueDate) > targetEnd
      );
      if (stillOpen.length > 0) {
        scheduledRemaining +=
          Number(stillOpen[0].remainingPrincipal) + Number(stillOpen[0].principalPart);
      }

      for (const s of rows) {
        const due = new Date(s.dueDate);
        if (s.status !== "ODENDI" && due >= target && due <= targetEnd) {
          monthlyPayment += Number(s.totalAmount);
        }
      }
    }

    const totalRemaining = scheduledRemaining + revolvingTL;
    if (projectedDebtFreeDate === null && totalRemaining <= 0) {
      projectedDebtFreeDate = targetEnd.toISOString();
    }

    monthlyProjection12Months.push({
      monthIndex: i + 1,
      monthName: format(target, "LLLL yyyy", { locale: tr }),
      scheduledRemainingTL: round(scheduledRemaining),
      revolvingRemainingTL: round(revolvingTL),
      remainingDebtTL: round(totalRemaining),
      monthlyPaymentTL: round(monthlyPayment),
    });
  }

  // Beyond the 12 month window, look for the last scheduled instalment.
  if (projectedDebtFreeDate === null && revolvingTL <= 0 && loans.length > 0) {
    const lastDue = loans
      .flatMap((l) => l.installmentSchedules.filter((s) => s.status !== "ODENDI"))
      .map((s) => new Date(s.dueDate).getTime())
      .sort((a, b) => b - a)[0];
    if (lastDue) projectedDebtFreeDate = new Date(lastDue).toISOString();
  }

  // --- 12 month cash flow history -----------------------------------------
  const cashFlowHistory: AnalyticsSummary["cashFlowHistory"] = [];
  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(monthStart, i);
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);
    const within = (d: Date | string) => {
      const date = new Date(d);
      return date >= mStart && date <= mEnd;
    };

    const incSum = incomes.filter((x) => within(x.date)).reduce((s, x) => s + Number(x.amount), 0);
    const expSum = expenses.filter((x) => within(x.date)).reduce((s, x) => s + Number(x.amount), 0);

    cashFlowHistory.push({
      monthLabel: format(monthDate, "LLL yy", { locale: tr }),
      incomeTL: round(incSum),
      expenseTL: round(expSum),
      netTL: round(incSum - expSum),
    });
  }

  return {
    totalDebtTL: round(portfolio.totalDebtTL),
    totalAccruedInterestTL: round(portfolio.totalAccruedInterestTL),
    dueThisMonthTL: round(portfolio.dueThisMonthTL),
    overdueTL: round(portfolio.overdueTL),
    totalMonthlyIncomeTL: round(totalMonthlyIncomeTL),
    totalMonthlyExpenseTL: round(totalMonthlyExpenseTL),
    netCashFlowTL: round(totalMonthlyIncomeTL - totalMonthlyExpenseTL - portfolio.dueThisMonthTL),
    debtTypeBreakdown,
    expenseCategoryBreakdown,
    incomeCategoryBreakdown,
    institutionBreakdown: portfolio.institutionBreakdown,
    monthlyProjection12Months,
    cashFlowHistory,
    goldStatus: gold
      ? {
          source: gold.source,
          sourceKind: gold.sourceKind,
          fetchedAt: gold.fetchedAt,
          warning: gold.warning,
          pureGramSellTL: gold.pureGramSellTL,
        }
      : null,
    projectedDebtFreeDate,
  };
}

// ------------------------------ CSV EXPORT ------------------------------

/** Escapes a value for a semicolon separated, Excel friendly CSV. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRows(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}

export async function generateCSV(
  userId: string,
  type: "debts" | "transactions" | "summary"
): Promise<string> {
  if (type === "debts") {
    const [debts, settings] = await Promise.all([getDebts(userId), getSettings(userId)]);
    let gold: GoldSyncResult | null = null;
    try {
      gold = await getGoldPrices();
    } catch {
      gold = null;
    }
    const portfolio = buildPortfolioSummary(debts, gold, settings);

    const headers = [
      "Borç Başlığı", "Tür", "Kurum", "Güncel Bakiye (TL)", "İşlemiş Faiz (TL)",
      "Aylık Faiz (%)", "Toplam Taksit", "Ödenen Taksit", "Kalan Taksit",
      "Taksit Tutarı (TL)", "Ödeme Günü", "Bu Ay Ödenecek (TL)", "Sonraki Vade",
      "Durum", "Notlar",
    ];

    const byId = new Map(debts.map((d) => [d.id, d]));
    const rows = portfolio.valuations.map((v) => [
      v.title,
      DEBT_TYPE_LABELS[v.type]?.label ?? v.type,
      v.institutionName ?? "-",
      v.outstandingTL,
      v.accruedInterestTL,
      v.monthlyInterestRatePercent ?? "",
      v.totalInstallments ?? "",
      v.paidInstallments ?? "",
      v.remainingInstallments ?? "",
      v.installmentAmountTL ?? "",
      v.paymentDayOfMonth ?? "",
      v.dueThisMonthTL,
      v.nextDueDate ? formatDateTR(v.nextDueDate) : "-",
      v.isOverdue ? "GECİKMİŞ" : v.status,
      byId.get(v.id)?.notes ?? "",
    ]);

    return csvRows([headers, ...rows]);
  }

  if (type === "transactions") {
    const [incomes, expenses] = await Promise.all([getIncomes(userId), getExpenses(userId)]);

    const headers = [
      "İşlem Türü", "Tanım", "Kategori", "Alt Kategori", "Tutar (TL)",
      "Para Birimi", "Tarih", "Ödeme Yöntemi", "İlgili Borç", "Not",
    ];

    const incRows = incomes.map((i) => [
      "GELİR",
      i.source,
      i.category?.name ?? "-",
      "",
      Number(i.amount),
      i.currency,
      formatDateTR(i.date),
      i.isRecurring ? "Düzenli" : "Tek seferlik",
      "",
      i.note ?? "",
    ]);

    const expRows = expenses.map((e) => [
      "GİDER",
      e.merchant ?? e.category?.name ?? "Harcama",
      e.category?.name ?? "-",
      e.subcategory?.name ?? "",
      Number(e.amount),
      e.currency,
      formatDateTR(e.date),
      e.paymentMethod,
      e.relatedDebt?.title ?? "",
      e.note ?? "",
    ]);

    return csvRows([headers, ...incRows, ...expRows]);
  }

  const summary = await getAnalyticsSummary(userId);
  const rows: unknown[][] = [
    ["Metrik / Kalem", "Değer"],
    ["Toplam Borç Yükü (TL)", summary.totalDebtTL],
    ["Bunun içindeki işlemiş faiz (TL)", summary.totalAccruedInterestTL],
    ["Bu Ay Ödenecek (TL)", summary.dueThisMonthTL],
    ["Geciken (TL)", summary.overdueTL],
    ["Bu Ayki Toplam Gelir (TL)", summary.totalMonthlyIncomeTL],
    ["Bu Ayki Toplam Gider (TL)", summary.totalMonthlyExpenseTL],
    ["Bu Ayki Net Nakit Akışı (TL)", summary.netCashFlowTL],
    ["", ""],
    ["BORÇ TÜRLERİ DAĞILIMI", ""],
    ...summary.debtTypeBreakdown.map((b) => [b.label, `${b.amountTL} (%${b.percentage})`]),
    ["", ""],
    ["KURUM BAZLI DAĞILIM", ""],
    ...summary.institutionBreakdown.map((i) => [
      i.institutionName,
      `${i.totalOutstandingTL} TL / ${i.debtCount} kayıt`,
    ]),
    ["", ""],
    ["GİDER KATEGORİLERİ (BU AY)", ""],
    ...summary.expenseCategoryBreakdown.map((c) => [
      c.categoryName,
      `${c.amountTL} (%${c.percentage})`,
    ]),
  ];

  if (summary.goldStatus?.warning) {
    rows.push(["", ""], ["ALTIN FİYAT UYARISI", summary.goldStatus.warning]);
  }

  return csvRows(rows);
}

// --------------------------- BACKUP / RESTORE ---------------------------

export const BACKUP_VERSION = "2.0";

export async function getFullBackupJSON(userId: string) {
  const [debts, incomes, expenses, categories, institutions, settings] = await Promise.all([
    getDebts(userId, { includeArchived: true }),
    getIncomes(userId, { includeArchived: true }),
    getExpenses(userId, { includeArchived: true }),
    getCategories(userId),
    getInstitutions(),
    getRawSettings(userId),
  ]);

  return {
    meta: {
      app: "borcolcme",
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
    },
    institutions,
    categories,
    debts,
    incomes,
    expenses,
    settings: Object.entries(settings).map(([key, value]) => ({ key, value })),
  };
}

export interface RestoreReport {
  institutions: number;
  categories: number;
  debts: number;
  installments: number;
  payments: number;
  incomes: number;
  expenses: number;
  settings: number;
  skipped: string[];
}

/**
 * Restores a backup produced by `getFullBackupJSON`.
 *
 * `replace` wipes the user's own rows first; otherwise the restore is additive
 * and existing ids are skipped. Everything runs in a single transaction, so a
 * failure leaves the database exactly as it was.
 */
export async function restoreBackup(
  userId: string,
  payload: {
    institutions?: Array<Record<string, unknown>>;
    categories?: Array<Record<string, unknown>>;
    debts?: Array<Record<string, unknown>>;
    incomes?: Array<Record<string, unknown>>;
    expenses?: Array<Record<string, unknown>>;
    settings?: Array<Record<string, unknown>>;
  },
  options: { replace?: boolean } = {}
): Promise<RestoreReport> {
  const report: RestoreReport = {
    institutions: 0, categories: 0, debts: 0, installments: 0,
    payments: 0, incomes: 0, expenses: 0, settings: 0, skipped: [],
  };

  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
  const date = (v: unknown): Date | null => {
    if (!v) return null;
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const dec = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

  await prisma.$transaction(
    async (tx) => {
      if (options.replace) {
        await tx.expense.deleteMany({ where: { userId } });
        await tx.income.deleteMany({ where: { userId } });
        await tx.debt.deleteMany({ where: { userId } }); // cascades schedules + payments
        await tx.category.deleteMany({ where: { userId, isSystem: false } });
      }

      // Institutions are global; match by name so ids can be remapped.
      const institutionIdMap = new Map<string, string>();
      for (const raw of payload.institutions ?? []) {
        const name = str(raw.name);
        if (!name) continue;
        const existing = await tx.institution.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
        });
        const record =
          existing ??
          (await tx.institution.create({
            data: {
              name,
              type: (str(raw.type) ?? "BANKA") as never,
              color: str(raw.color),
              logoUrl: str(raw.logoUrl),
            },
          }));
        if (!existing) report.institutions += 1;
        if (str(raw.id)) institutionIdMap.set(str(raw.id)!, record.id);
      }

      // Categories: parents first so children can attach.
      const categoryIdMap = new Map<string, string>();
      const cats = payload.categories ?? [];
      for (const pass of [0, 1]) {
        for (const raw of cats) {
          const oldId = str(raw.id);
          const name = str(raw.name);
          const type = str(raw.type);
          const parentOld = str(raw.parentId);
          if (!name || (type !== "GELIR" && type !== "GIDER")) continue;
          if (pass === 0 && parentOld) continue;
          if (pass === 1 && !parentOld) continue;
          if (oldId && categoryIdMap.has(oldId)) continue;

          const parentId = parentOld ? (categoryIdMap.get(parentOld) ?? null) : null;
          const existing = await tx.category.findFirst({
            where: { userId, type, parentId, name: { equals: name, mode: "insensitive" } },
          });
          const record =
            existing ??
            (await tx.category.create({
              data: {
                userId,
                name,
                type,
                parentId,
                icon: str(raw.icon) ?? "Tag",
                color: str(raw.color) ?? "#10b981",
                isSystem: raw.isSystem === true,
              },
            }));
          if (!existing) report.categories += 1;
          if (oldId) categoryIdMap.set(oldId, record.id);
        }
      }

      for (const raw of payload.debts ?? []) {
        const title = str(raw.title);
        const type = str(raw.type);
        if (!title || !type) {
          report.skipped.push(`Borç atlandı (başlık/tür eksik)`);
          continue;
        }

        const oldInst = str(raw.institutionId);
        const created = await tx.debt.create({
          data: {
            userId,
            title,
            type: type as never,
            institutionId: oldInst ? (institutionIdMap.get(oldInst) ?? null) : null,
            description: str(raw.description),
            status: (str(raw.status) ?? "AKTIF") as never,
            currency: (str(raw.currency) ?? "TRY") as never,
            startDate: date(raw.startDate) ?? new Date(),
            notes: str(raw.notes),
            color: str(raw.color),
            tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
            isArchived: raw.isArchived === true,

            loanSubType: (str(raw.loanSubType) ?? null) as never,
            principal: dec(raw.principal),
            interestRateMonthly: dec(raw.interestRateMonthly),
            installmentCount: (raw.installmentCount as number) ?? null,
            installmentAmount: dec(raw.installmentAmount),
            firstPaymentDate: date(raw.firstPaymentDate),
            paymentDayOfMonth: (raw.paymentDayOfMonth as number) ?? null,
            paidInstallments: (raw.paidInstallments as number) ?? 0,
            includeKKDF: (raw.includeKKDF as boolean) ?? true,
            kkdfRate: dec(raw.kkdfRate),
            includeBSMV: (raw.includeBSMV as boolean) ?? true,
            bsmvRate: dec(raw.bsmvRate),
            earlyPayoffEnabled: (raw.earlyPayoffEnabled as boolean) ?? false,
            loanAccountNo: str(raw.loanAccountNo),

            cardName: str(raw.cardName),
            last4: str(raw.last4),
            creditLimit: dec(raw.creditLimit),
            currentStatementBalance: dec(raw.currentStatementBalance),
            minimumPayment: dec(raw.minimumPayment),
            statementDay: (raw.statementDay as number) ?? null,
            dueDay: (raw.dueDay as number) ?? null,
            contractualInterestMonthly: dec(raw.contractualInterestMonthly),
            overdueInterestMonthly: dec(raw.overdueInterestMonthly),
            installmentsOnCard: (raw.installmentsOnCard ?? undefined) as never,

            limit: dec(raw.limit),
            usedAmount: dec(raw.usedAmount),
            lastInterestChargeDate: date(raw.lastInterestChargeDate),
            accrualBasis: (str(raw.accrualBasis) ?? null) as never,

            goldType: (str(raw.goldType) ?? null) as never,
            quantity: dec(raw.quantity),
            grams: dec(raw.grams),
            karat: (raw.karat as number) ?? null,
            priceSource: (str(raw.priceSource) ?? null) as never,
            manualUnitPrice: dec(raw.manualUnitPrice),
            premiumTL: dec(raw.premiumTL),
            creditorName: str(raw.creditorName),
            dueDate: date(raw.dueDate),
            isInterestFree: (raw.isInterestFree as boolean) ?? null,

            creditorPhone: str(raw.creditorPhone),
            amount: dec(raw.amount),
            hasInterest: (raw.hasInterest as boolean) ?? null,
            installmentPlan: (raw.installmentPlan ?? undefined) as never,

            documentType: (str(raw.documentType) ?? null) as never,
            documentNo: str(raw.documentNo),
            drawee: str(raw.drawee),

            frequency: (str(raw.frequency) ?? null) as never,
            nextDueDate: date(raw.nextDueDate),
            autoCreateExpense: (raw.autoCreateExpense as boolean) ?? false,
          },
        });
        report.debts += 1;

        const schedules = Array.isArray(raw.installmentSchedules)
          ? (raw.installmentSchedules as Array<Record<string, unknown>>)
          : [];
        const scheduleIdMap = new Map<string, string>();
        for (const s of schedules) {
          const due = date(s.dueDate);
          if (due === null || s.installmentNo === undefined) continue;
          const row = await tx.installmentSchedule.create({
            data: {
              debtId: created.id,
              installmentNo: Number(s.installmentNo),
              dueDate: due,
              totalAmount: dec(s.totalAmount) ?? "0",
              principalPart: dec(s.principalPart) ?? "0",
              interestPart: dec(s.interestPart) ?? "0",
              remainingPrincipal: dec(s.remainingPrincipal) ?? "0",
              status: (str(s.status) ?? "BEKLIYOR") as never,
              paidAt: date(s.paidAt),
              paidAmount: dec(s.paidAmount),
            },
          });
          report.installments += 1;
          if (str(s.id)) scheduleIdMap.set(str(s.id)!, row.id);
        }

        const payments = Array.isArray(raw.payments)
          ? (raw.payments as Array<Record<string, unknown>>)
          : [];
        for (const p of payments) {
          const oldSchedule = str(p.installmentId);
          await tx.payment.create({
            data: {
              debtId: created.id,
              installmentId: oldSchedule ? (scheduleIdMap.get(oldSchedule) ?? null) : null,
              amount: dec(p.amount) ?? "0",
              paidAt: date(p.paidAt) ?? new Date(),
              method: (str(p.method) ?? "HAVALE") as never,
              principalPart: dec(p.principalPart),
              interestPart: dec(p.interestPart),
              note: str(p.note),
            },
          });
          report.payments += 1;
        }
      }

      for (const raw of payload.incomes ?? []) {
        const oldCat = str(raw.categoryId);
        const categoryId = oldCat ? categoryIdMap.get(oldCat) : null;
        if (!categoryId) {
          report.skipped.push(`Gelir atlandı: kategori eşleşmedi (${str(raw.source) ?? "?"})`);
          continue;
        }
        await tx.income.create({
          data: {
            userId,
            categoryId,
            amount: dec(raw.amount) ?? "0",
            currency: (str(raw.currency) ?? "TRY") as never,
            date: date(raw.date) ?? new Date(),
            source: str(raw.source) ?? "Gelir",
            isRecurring: raw.isRecurring === true,
            recurrenceRule: str(raw.recurrenceRule),
            note: str(raw.note),
            isArchived: raw.isArchived === true,
          },
        });
        report.incomes += 1;
      }

      for (const raw of payload.expenses ?? []) {
        const oldCat = str(raw.categoryId);
        const categoryId = oldCat ? categoryIdMap.get(oldCat) : null;
        if (!categoryId) {
          report.skipped.push(`Gider atlandı: kategori eşleşmedi (${str(raw.merchant) ?? "?"})`);
          continue;
        }
        const oldSub = str(raw.subcategoryId);
        await tx.expense.create({
          data: {
            userId,
            categoryId,
            subcategoryId: oldSub ? (categoryIdMap.get(oldSub) ?? null) : null,
            amount: dec(raw.amount) ?? "0",
            currency: (str(raw.currency) ?? "TRY") as never,
            date: date(raw.date) ?? new Date(),
            merchant: str(raw.merchant),
            paymentMethod: (str(raw.paymentMethod) ?? "KART") as never,
            note: str(raw.note),
            isArchived: raw.isArchived === true,
          },
        });
        report.expenses += 1;
      }

      for (const raw of payload.settings ?? []) {
        const key = str(raw.key);
        if (!key || raw.value === undefined) continue;
        await tx.setting.upsert({
          where: { userId_key: { userId, key } },
          update: { value: raw.value as never },
          create: { userId, key, value: raw.value as never },
        });
        report.settings += 1;
      }
    },
    { timeout: 120_000, maxWait: 20_000 }
  );

  return report;
}
