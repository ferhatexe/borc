import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "./debts";
import type {
  CreateExpenseInput,
  CreateIncomeInput,
  ListFilter,
} from "@/lib/validation/transaction";

/** Inclusive month window in local time. */
function monthRange(year: number, month: number) {
  return {
    gte: new Date(year, month - 1, 1, 0, 0, 0, 0),
    lt: new Date(year, month, 1, 0, 0, 0, 0),
  };
}

function dateFilter(filters: ListFilter): Prisma.DateTimeFilter | undefined {
  if (filters.from || filters.to) {
    return {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.year && filters.month) return monthRange(filters.year, filters.month);
  if (filters.year) {
    return {
      gte: new Date(filters.year, 0, 1),
      lt: new Date(filters.year + 1, 0, 1),
    };
  }
  return undefined;
}

// ------------------------------- INCOME -------------------------------

export const INCOME_INCLUDE = { category: true } satisfies Prisma.IncomeInclude;
export type IncomeWithCategory = Prisma.IncomeGetPayload<{ include: typeof INCOME_INCLUDE }>;

export async function createIncome(
  userId: string,
  input: CreateIncomeInput
): Promise<IncomeWithCategory> {
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, type: "GELIR", OR: [{ userId }, { userId: null }] },
    select: { id: true },
  });
  if (!category) throw new NotFoundError("Seçilen gelir kategorisi bulunamadı");

  return prisma.income.create({
    data: {
      userId,
      categoryId: category.id,
      amount: new Prisma.Decimal(input.amount.toString()),
      currency: input.currency,
      date: input.date,
      source: input.source,
      isRecurring: input.isRecurring,
      recurrenceRule: input.recurrenceRule ?? null,
      note: input.note ?? null,
    },
    include: INCOME_INCLUDE,
  });
}

export async function getIncomes(
  userId: string,
  filters: ListFilter & { includeArchived?: boolean } = {}
): Promise<IncomeWithCategory[]> {
  const date = dateFilter(filters);
  return prisma.income.findMany({
    where: {
      userId,
      ...(filters.includeArchived ? {} : { isArchived: false }),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(date ? { date } : {}),
    },
    include: INCOME_INCLUDE,
    orderBy: { date: "desc" },
  });
}

/** Soft delete (şartname §11). */
export async function archiveIncome(userId: string, id: string) {
  const result = await prisma.income.updateMany({
    where: { id, userId, isArchived: false },
    data: { isArchived: true },
  });
  if (result.count === 0) throw new NotFoundError("Gelir kaydı bulunamadı");
  return true;
}

export async function deleteIncomePermanently(userId: string, id: string) {
  const result = await prisma.income.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError("Gelir kaydı bulunamadı");
  return true;
}

// ------------------------------ EXPENSE -------------------------------

export const EXPENSE_INCLUDE = {
  category: true,
  subcategory: true,
  relatedDebt: { select: { id: true, title: true, type: true } },
} satisfies Prisma.ExpenseInclude;
export type ExpenseWithRelations = Prisma.ExpenseGetPayload<{ include: typeof EXPENSE_INCLUDE }>;

export async function createExpense(
  userId: string,
  input: CreateExpenseInput
): Promise<ExpenseWithRelations> {
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, type: "GIDER", OR: [{ userId }, { userId: null }] },
    select: { id: true },
  });
  if (!category) throw new NotFoundError("Seçilen gider kategorisi bulunamadı");

  if (input.subcategoryId) {
    const sub = await prisma.category.findFirst({
      where: { id: input.subcategoryId, type: "GIDER", OR: [{ userId }, { userId: null }] },
      select: { id: true },
    });
    if (!sub) throw new NotFoundError("Seçilen alt kategori bulunamadı");
  }

  if (input.relatedDebtId) {
    const debt = await prisma.debt.findFirst({
      where: { id: input.relatedDebtId, userId },
      select: { id: true },
    });
    if (!debt) throw new NotFoundError("Harcamanın bağlanacağı borç kaydı bulunamadı");
  }

  const amount = new Prisma.Decimal(input.amount.toString());

  return prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        userId,
        categoryId: category.id,
        subcategoryId: input.subcategoryId ?? null,
        amount,
        currency: input.currency,
        date: input.date,
        merchant: input.merchant ?? null,
        paymentMethod: input.paymentMethod,
        relatedDebtId: input.relatedDebtId ?? null,
        note: input.note ?? null,
      },
      include: EXPENSE_INCLUDE,
    });

    // A card purchase raises that card's statement balance.
    if (input.relatedDebtId && input.paymentMethod === "KREDI_KARTI") {
      await tx.debt.updateMany({
        where: { id: input.relatedDebtId, userId, type: "KREDI_KARTI" },
        data: { currentStatementBalance: { increment: amount } },
      });
    }

    return created;
  });
}

export async function getExpenses(
  userId: string,
  filters: ListFilter & { includeArchived?: boolean } = {}
): Promise<ExpenseWithRelations[]> {
  const date = dateFilter(filters);
  return prisma.expense.findMany({
    where: {
      userId,
      ...(filters.includeArchived ? {} : { isArchived: false }),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
      ...(date ? { date } : {}),
    },
    include: EXPENSE_INCLUDE,
    orderBy: { date: "desc" },
  });
}

export async function archiveExpense(userId: string, id: string) {
  const expense = await prisma.expense.findFirst({
    where: { id, userId, isArchived: false },
    select: { id: true, amount: true, relatedDebtId: true, paymentMethod: true },
  });
  if (!expense) throw new NotFoundError("Gider kaydı bulunamadı");

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({ where: { id: expense.id }, data: { isArchived: true } });

    // Reverse the statement balance this expense had added.
    if (expense.relatedDebtId && expense.paymentMethod === "KREDI_KARTI") {
      await tx.debt.updateMany({
        where: { id: expense.relatedDebtId, userId, type: "KREDI_KARTI" },
        data: { currentStatementBalance: { decrement: expense.amount } },
      });
    }
  });

  return true;
}

export async function deleteExpensePermanently(userId: string, id: string) {
  const result = await prisma.expense.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError("Gider kaydı bulunamadı");
  return true;
}

// ------------------------------ KASA ----------------------------------

export interface CashBalance {
  /** Elde kalan nakit: tüm zamanların geliri eksi gideri. */
  balanceTL: number;
  totalIncomeTL: number;
  totalExpenseTL: number;
}

/**
 * Kasadaki nakit.
 *
 * Gelir eklendiğinde artar, gider (borç ödemeleri dahil, çünkü ödeme aynı
 * anda bir gider kaydı oluşturur) düştüğünde azalır. Satırları çekip toplamak
 * yerine veritabanında toplanır; kayıt sayısı büyüdükçe fark eder.
 */
export async function getCashBalance(userId: string): Promise<CashBalance> {
  const [income, expense] = await Promise.all([
    prisma.income.aggregate({
      where: { userId, isArchived: false },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { userId, isArchived: false },
      _sum: { amount: true },
    }),
  ]);

  const totalIncomeTL = Number(income._sum.amount ?? 0);
  const totalExpenseTL = Number(expense._sum.amount ?? 0);

  return {
    balanceTL: Math.round((totalIncomeTL - totalExpenseTL) * 100) / 100,
    totalIncomeTL,
    totalExpenseTL,
  };
}
