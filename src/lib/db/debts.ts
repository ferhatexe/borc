import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import {
  calculateAnnuityInstallment,
  generateAmortizationSchedule,
  solveMonthlyInterestRate,
} from "@/lib/finance/annuity";
import { getSettings } from "@/lib/db/settings";
import type { CreateDebtInput, PayInstallmentInput, UpdateDebtInput } from "@/lib/validation/debt";

/**
 * There is no in-memory fallback anywhere in this file on purpose. A database
 * error must surface to the caller: silently writing to a module-level array
 * made the app look like it saved data that vanished on the next restart.
 */

export class NotFoundError extends Error {
  constructor(message = "Kayıt bulunamadı") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message = "İşlem mevcut durumla çelişiyor") {
    super(message);
    this.name = "ConflictError";
  }
}

/** null/undefined stay null; 0 is a real value and must survive. */
function dec(value: number | string | Decimal | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  return new Prisma.Decimal(value.toString());
}

function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export const DEBT_INCLUDE = {
  institution: true,
  installmentSchedules: { orderBy: { installmentNo: "asc" } },
  payments: { orderBy: { paidAt: "desc" } },
} satisfies Prisma.DebtInclude;

export type DebtWithRelations = Prisma.DebtGetPayload<{ include: typeof DEBT_INCLUDE }>;

/**
 * Builds the amortisation rows for an instalment loan.
 * Instalment 1 lands on `firstPaymentDate`, matching what the wizard previews.
 */
async function buildSchedules(userId: string, input: CreateDebtInput) {
  if (
    input.type !== "TAKSITLI_KREDI" ||
    input.principal == null ||
    input.installmentCount == null ||
    input.interestRateMonthly == null
  ) {
    return [];
  }

  const settings = await getSettings(userId);

  const kkdfRate = input.kkdfRate ?? settings.taxRates.kkdfRate;
  const bsmvRate = input.bsmvRate ?? settings.taxRates.bsmvRate;

  /*
   * Türk bankalarında taksit genellikle dosya masrafı ve sigorta da içerir, bu
   * yüzden akdi faizden hesaplanan taksitten yüksektir. Kullanıcı bankanın
   * söylediği taksiti girdiyse plan ona göre kurulmalı, AMA faiz oranı da o
   * taksitten çözülmeli.
   *
   * Aksi hâlde faiz payları düşük kalır, anapara payları yüksek çıkar ve son
   * taksit kalanı emerek diğerlerinden farklı bir tutara düşer; oysa bankanın
   * tablosunda beş taksit de eşittir. Kullanıcının girdiği akdi faiz
   * `interestRateMonthly` alanında gösterim için saklanmaya devam eder.
   */
  const statedInstallment = input.installmentAmount ?? 0;
  let scheduleRatePercent: number | Decimal = input.interestRateMonthly;

  if (statedInstallment > 0) {
    const fromRate = calculateAnnuityInstallment({
      principal: input.principal,
      monthlyInterestRatePercent: input.interestRateMonthly,
      installmentCount: input.installmentCount,
      includeKKDF: input.includeKKDF,
      kkdfRate,
      includeBSMV: input.includeBSMV,
      bsmvRate,
    }).installmentAmount;

    // Bir kuruştan fazla fark varsa taksit, orandan türetilenle uyuşmuyor.
    if (fromRate.minus(statedInstallment).abs().greaterThan("0.01")) {
      scheduleRatePercent = solveMonthlyInterestRate(
        input.principal,
        statedInstallment,
        input.installmentCount,
        input.includeKKDF,
        input.includeBSMV,
        kkdfRate,
        bsmvRate
      ).rawMonthlyRatePercent;
    }
  }

  const rows = generateAmortizationSchedule({
    principal: input.principal,
    monthlyInterestRatePercent: scheduleRatePercent,
    installmentCount: input.installmentCount,
    includeKKDF: input.includeKKDF,
    kkdfRate,
    includeBSMV: input.includeBSMV,
    bsmvRate,
    firstPaymentDate: input.firstPaymentDate ?? input.startDate,
    paymentDayOfMonth: input.paymentDayOfMonth,
    installmentAmountOverride: statedInstallment || null,
  });

  // Kredi ortasından ekleniyorsa ilk N taksit ödenmiş kabul edilir; böylece
  // kalan anapara, erken kapama ve gecikme hesapları gerçeği yansıtır.
  const alreadyPaid = Math.max(0, Math.min(input.paidInstallments ?? 0, rows.length));

  return rows.map((row, index) => {
    const isPaid = index < alreadyPaid;
    return {
      installmentNo: row.installmentNo,
      dueDate: row.dueDate,
      totalAmount: new Prisma.Decimal(row.totalPayment.toString()),
      principalPart: new Prisma.Decimal(row.principalPayment.toString()),
      interestPart: new Prisma.Decimal(
        row.interestPayment.plus(row.kkdfPayment).plus(row.bsmvPayment).toString()
      ),
      remainingPrincipal: new Prisma.Decimal(row.remainingPrincipal.toString()),
      status: (isPaid ? "ODENDI" : "BEKLIYOR") as "ODENDI" | "BEKLIYOR",
      paidAt: isPaid ? row.dueDate : null,
      paidAmount: isPaid ? new Prisma.Decimal(row.totalPayment.toString()) : null,
    };
  });
}

export async function createDebt(userId: string, input: CreateDebtInput): Promise<DebtWithRelations> {
  const schedules = await buildSchedules(userId, input);

  if (input.institutionId) {
    const institution = await prisma.institution.findUnique({ where: { id: input.institutionId } });
    if (!institution) throw new NotFoundError("Seçilen kurum bulunamadı");
  }

  return prisma.debt.create({
    data: {
      userId,
      institutionId: input.institutionId ?? null,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      currency: input.currency,
      startDate: input.startDate,
      notes: input.notes ?? null,
      color: input.color ?? null,
      tags: input.tags ?? [],

      loanSubType: input.loanSubType ?? null,
      principal: dec(input.principal),
      interestRateMonthly: dec(input.interestRateMonthly),
      installmentCount: input.installmentCount ?? null,
      installmentAmount: dec(input.installmentAmount),
      firstPaymentDate: input.firstPaymentDate ?? null,
      paymentDayOfMonth: input.paymentDayOfMonth ?? null,
      paidInstallments: input.paidInstallments ?? 0,
      includeKKDF: input.includeKKDF ?? true,
      kkdfRate: dec(input.kkdfRate),
      includeBSMV: input.includeBSMV ?? true,
      bsmvRate: dec(input.bsmvRate),
      earlyPayoffEnabled: input.earlyPayoffEnabled ?? false,
      loanAccountNo: input.loanAccountNo ?? null,
      currentPrincipalOverride: dec(input.currentPrincipalOverride),
      principalOverrideAt:
        input.currentPrincipalOverride != null ? new Date() : null,

      cardName: input.cardName ?? null,
      last4: input.last4 ?? null,
      creditLimit: dec(input.creditLimit),
      currentStatementBalance: dec(input.currentStatementBalance),
      minimumPayment: dec(input.minimumPayment),
      statementDay: input.statementDay ?? null,
      dueDay: input.dueDay ?? null,
      contractualInterestMonthly: dec(input.contractualInterestMonthly),
      overdueInterestMonthly: dec(input.overdueInterestMonthly),
      installmentsOnCard: jsonOrNull(input.installmentsOnCard),

      limit: dec(input.limit),
      usedAmount: dec(input.usedAmount),
      lastInterestChargeDate: input.lastInterestChargeDate ?? input.startDate,
      accrualBasis: input.type === "EK_HESAP_KMH" ? (input.accrualBasis ?? "GUNLUK") : null,

      goldType: input.goldType ?? null,
      quantity: dec(input.quantity),
      grams: dec(input.grams),
      karat: input.karat ?? null,
      priceSource: input.priceSource ?? null,
      manualUnitPrice: dec(input.manualUnitPrice),
      premiumTL: dec(input.premiumTL),
      creditorName: input.creditorName ?? null,
      dueDate: input.dueDate ?? null,
      isInterestFree: input.isInterestFree ?? null,

      creditorPhone: input.creditorPhone ?? null,
      amount: dec(input.amount),
      hasInterest: input.hasInterest ?? null,
      installmentPlan: jsonOrNull(input.installmentPlan),

      documentType: input.documentType ?? null,
      documentNo: input.documentNo ?? null,
      drawee: input.drawee ?? null,

      frequency: input.frequency ?? null,
      nextDueDate: input.nextDueDate ?? null,
      autoCreateExpense: input.autoCreateExpense ?? false,

      installmentSchedules: schedules.length > 0 ? { create: schedules } : undefined,
    },
    include: DEBT_INCLUDE,
  });
}

export interface DebtFilters {
  institutionId?: string;
  type?: string;
  status?: string;
  includeArchived?: boolean;
}

export async function getDebts(userId: string, filters: DebtFilters = {}): Promise<DebtWithRelations[]> {
  return prisma.debt.findMany({
    where: {
      userId,
      ...(filters.includeArchived ? {} : { isArchived: false }),
      ...(filters.institutionId ? { institutionId: filters.institutionId } : {}),
      ...(filters.type ? { type: filters.type as never } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
    },
    include: DEBT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

/** Always scoped by userId - an id alone must never be enough to read a debt. */
export async function getDebtById(userId: string, id: string): Promise<DebtWithRelations | null> {
  return prisma.debt.findFirst({
    where: { id, userId },
    include: DEBT_INCLUDE,
  });
}

export async function updateDebt(
  userId: string,
  id: string,
  input: UpdateDebtInput
): Promise<DebtWithRelations> {
  const existing = await prisma.debt.findFirst({
    where: { id, userId },
    select: {
      id: true,
      type: true,
      installmentCount: true,
      paidInstallments: true,
      firstPaymentDate: true,
    },
  });
  if (!existing) throw new NotFoundError("Borç kaydı bulunamadı");

  const data: Prisma.DebtUpdateInput = {};
  const assign = <K extends keyof UpdateDebtInput>(key: K, value: unknown) => {
    if (input[key] !== undefined) (data as Record<string, unknown>)[key as string] = value;
  };

  assign("title", input.title);
  assign("description", input.description ?? null);
  assign("notes", input.notes ?? null);
  assign("color", input.color ?? null);
  assign("tags", input.tags);
  assign("status", input.status);
  assign("currency", input.currency);
  assign("startDate", input.startDate);
  assign("principal", dec(input.principal));
  assign("interestRateMonthly", dec(input.interestRateMonthly));
  assign("installmentAmount", dec(input.installmentAmount));
  assign("paymentDayOfMonth", input.paymentDayOfMonth ?? null);
  assign("creditLimit", dec(input.creditLimit));
  assign("currentStatementBalance", dec(input.currentStatementBalance));
  assign("minimumPayment", dec(input.minimumPayment));
  assign("statementDay", input.statementDay ?? null);
  assign("dueDay", input.dueDay ?? null);
  assign("contractualInterestMonthly", dec(input.contractualInterestMonthly));
  assign("overdueInterestMonthly", dec(input.overdueInterestMonthly));
  assign("limit", dec(input.limit));
  assign("usedAmount", dec(input.usedAmount));
  assign("lastInterestChargeDate", input.lastInterestChargeDate ?? null);
  assign("quantity", dec(input.quantity));
  assign("grams", dec(input.grams));
  assign("karat", input.karat ?? null);
  assign("priceSource", input.priceSource ?? null);
  assign("manualUnitPrice", dec(input.manualUnitPrice));
  assign("premiumTL", dec(input.premiumTL));
  assign("creditorName", input.creditorName ?? null);
  assign("creditorPhone", input.creditorPhone ?? null);
  assign("amount", dec(input.amount));
  assign("dueDate", input.dueDate ?? null);
  assign("nextDueDate", input.nextDueDate ?? null);
  assign("frequency", input.frequency ?? null);
  assign("autoCreateExpense", input.autoCreateExpense);
  assign("documentNo", input.documentNo ?? null);
  assign("drawee", input.drawee ?? null);
  assign("loanAccountNo", input.loanAccountNo ?? null);
  assign("earlyPayoffEnabled", input.earlyPayoffEnabled);

  /*
   * Aşağıdaki alanlar da güncellenebilmeli.
   *
   * Şemada tanımlıydılar ve düzenleme formu bunları gönderiyordu ama burada
   * yazılmıyorlardı: kullanıcı kart adını, ayarını ya da vergi tercihini
   * değiştirip kaydettiğinde istek 200 dönüyor, değişiklik ise hiç
   * kaydedilmiyordu. Sessiz kayıp, hata mesajından beterdir.
   *
   * KKDF/BSMV bayrakları yalnızca kozmetik değil: taksitli kredinin günlük
   * faiz tahakkuku bunlardan hesaplanıyor (bkz. valuateDebt).
   */
  assign("loanSubType", input.loanSubType ?? null);
  assign("includeKKDF", input.includeKKDF);
  assign("kkdfRate", dec(input.kkdfRate));
  assign("includeBSMV", input.includeBSMV);
  assign("bsmvRate", dec(input.bsmvRate));
  assign("cardName", input.cardName ?? null);
  assign("last4", input.last4 ?? null);
  assign("accrualBasis", input.accrualBasis ?? null);
  assign("goldType", input.goldType ?? null);
  assign("isInterestFree", input.isInterestFree);
  assign("hasInterest", input.hasInterest);
  assign("documentType", input.documentType ?? null);

  /*
   * Planı yeniden kurmayı gerektiren alanlar.
   *
   * `updateDebt` amortisman tablosuna dokunmuyor; taksit sayısını ya da ilk
   * vadeyi burada değiştirmek kaydı kendi planıyla çelişir hâle getirirdi -
   * borç "6 taksit" der, tabloda 5 satır durur. Bu yüzden değişiklik sessizce
   * yutulmuyor, açıkça reddediliyor: kullanıcı ne olduğunu görsün.
   *
   * Aynı değer tekrar gönderilirse (formun tamamını POST eden ekranlar böyle
   * yapar) sorun yok, yalnızca gerçekten farklıysa hata verilir.
   */
  const planAlanlari: Array<[keyof UpdateDebtInput, unknown, string]> = [
    ["type", existing.type, "Borç türü"],
    ["installmentCount", existing.installmentCount, "Taksit sayısı"],
    ["paidInstallments", existing.paidInstallments, "Ödenen taksit sayısı"],
    ["firstPaymentDate", existing.firstPaymentDate, "İlk ödeme tarihi"],
  ];
  for (const [alan, mevcut, etiket] of planAlanlari) {
    const gelen = input[alan];
    if (gelen === undefined || gelen === null) continue;
    const ayni =
      gelen instanceof Date && mevcut instanceof Date
        ? gelen.getTime() === mevcut.getTime()
        : String(gelen) === String(mevcut ?? "");
    if (!ayni) {
      throw new ConflictError(
        `${etiket} bir kaydın ödeme planını baştan kurmayı gerektirir; düzenleme ile değiştirilemez. Borcu silip yeniden ekleyin.`
      );
    }
  }
  if (input.currentPrincipalOverride !== undefined) {
    data.currentPrincipalOverride = dec(input.currentPrincipalOverride);
    data.principalOverrideAt = input.currentPrincipalOverride != null ? new Date() : null;
  }

  if (input.installmentsOnCard !== undefined) {
    data.installmentsOnCard = jsonOrNull(input.installmentsOnCard);
  }
  if (input.installmentPlan !== undefined) {
    data.installmentPlan = jsonOrNull(input.installmentPlan);
  }
  if (input.institutionId !== undefined) {
    data.institution = input.institutionId
      ? { connect: { id: input.institutionId } }
      : { disconnect: true };
  }

  return prisma.debt.update({ where: { id }, data, include: DEBT_INCLUDE });
}

/**
 * Records a payment.
 *
 * Everything happens inside one transaction and the instalment is guarded
 * against a double tap: paying an already-settled instalment is rejected
 * instead of inflating the paid counter. `paidInstallments` is recomputed from
 * the schedule rather than blindly incremented.
 */
export async function payInstallment(
  userId: string,
  debtId: string,
  input: PayInstallmentInput
) {
  const paidAt = input.paidAt ?? new Date();
  const amount = new Prisma.Decimal(input.amount.toString());

  return prisma.$transaction(async (tx) => {
    const debt = await tx.debt.findFirst({
      where: { id: debtId, userId },
      select: {
        id: true,
        title: true,
        type: true,
        usedAmount: true,
        currentStatementBalance: true,
        grams: true,
        quantity: true,
        currentPrincipalOverride: true,
      },
    });
    if (!debt) throw new NotFoundError("Borç kaydı bulunamadı");

    let installment = null as Awaited<ReturnType<typeof tx.installmentSchedule.findFirst>> | null;

    if (input.installmentId) {
      installment = await tx.installmentSchedule.findFirst({
        where: { id: input.installmentId, debtId: debt.id },
      });
      if (!installment) throw new NotFoundError("Taksit bu borca ait değil veya bulunamadı");
      if (installment.status === "ODENDI") {
        throw new ConflictError(
          `${installment.installmentNo}. taksit zaten ödenmiş görünüyor.`
        );
      }

      await tx.installmentSchedule.update({
        where: { id: installment.id },
        data: { status: "ODENDI", paidAt, paidAmount: amount },
      });
    }

    const payment = await tx.payment.create({
      data: {
        debtId: debt.id,
        installmentId: installment?.id ?? null,
        amount,
        paidAt,
        method: input.method,
        note:
          input.note ??
          (installment ? `${installment.installmentNo}. taksit ödemesi` : "Borç ödemesi"),
        principalPart: installment?.principalPart ?? null,
        interestPart: installment?.interestPart ?? null,
      },
    });

    // Recompute rather than increment, so a retry cannot drift the counter.
    const paidCount = await tx.installmentSchedule.count({
      where: { debtId: debt.id, status: "ODENDI" },
    });
    const pendingCount = await tx.installmentSchedule.count({
      where: { debtId: debt.id, status: { not: "ODENDI" } },
    });

    const debtUpdate: Prisma.DebtUpdateInput = { paidInstallments: paidCount };

    if (debt.type === "TAKSITLI_KREDI" && pendingCount === 0 && paidCount > 0) {
      debtUpdate.status = "KAPANDI";
    }

    /*
     * Bankadan elle girilmiş bakiye ödemeyle birlikte düşmeli.
     *
     * `currentPrincipalOverride` doluysa değerleme plan yerine onu okur. Taksit
     * ödeniyordu ama bu değer yerinde kalıyordu: kredi, taksidi ödendiği hâlde
     * aynı anaparayı göstermeye devam ediyordu. Bankanın erken ödemede de
     * yaptığı gibi ödenen taksitin plandaki anapara payı düşülür ve faiz saati
     * ödeme anına çekilir - o güne kadar işleyen faiz bu ödemeyle kapandı.
     * Son taksit ödenince elle girilmiş değer tamamen kalkar.
     */
    if (debt.type === "TAKSITLI_KREDI" && installment && debt.currentPrincipalOverride != null) {
      if (pendingCount === 0) {
        debtUpdate.currentPrincipalOverride = null;
        debtUpdate.principalOverrideAt = null;
      } else {
        const kalan = new Prisma.Decimal(debt.currentPrincipalOverride).minus(
          installment.principalPart
        );
        debtUpdate.currentPrincipalOverride = kalan.isNegative() ? new Prisma.Decimal(0) : kalan;
        debtUpdate.principalOverrideAt = paidAt;
      }
    }
    if (debt.type === "EK_HESAP_KMH") {
      const newUsed = new Prisma.Decimal(debt.usedAmount ?? 0).minus(amount);
      debtUpdate.usedAmount = newUsed.isNegative() ? new Prisma.Decimal(0) : newUsed;
      debtUpdate.lastInterestChargeDate = paidAt;
    }
    if (debt.type === "KREDI_KARTI") {
      const newBalance = new Prisma.Decimal(debt.currentStatementBalance ?? 0).minus(amount);
      debtUpdate.currentStatementBalance = newBalance.isNegative()
        ? new Prisma.Decimal(0)
        : newBalance;
    }

    /*
     * Altın borcu altınla kapanır.
     *
     * Ödenen TL tutarı borcu azaltmaz - borç "50 gram" ise, ödeme de gram
     * cinsinden düşülmelidir; aradaki kur farkı kalan borcun TL değerine
     * kendiliğinden yansır. Bu blok olmadığı için altın borcuna yapılan ödeme
     * kaydediliyor ama borç hiç azalmıyordu.
     */
    if (debt.type === "ALTIN_BORCU") {
      if (input.goldGrams != null && debt.grams != null) {
        const kalan = new Prisma.Decimal(debt.grams).minus(input.goldGrams.toString());
        debtUpdate.grams = kalan.isNegative() ? new Prisma.Decimal(0) : kalan;
        if (kalan.lessThanOrEqualTo(0)) debtUpdate.status = "KAPANDI";
      } else if (input.goldQuantity != null && debt.quantity != null) {
        const kalan = new Prisma.Decimal(debt.quantity).minus(input.goldQuantity.toString());
        debtUpdate.quantity = kalan.isNegative() ? new Prisma.Decimal(0) : kalan;
        if (kalan.lessThanOrEqualTo(0)) debtUpdate.status = "KAPANDI";
      }
      // Altın miktarı verilmediyse yalnızca ödeme ve gider kaydı düşülür;
      // borcun kendisi bilerek değiştirilmez, uydurma bir gram hesaplanmaz.
    }

    await tx.debt.update({ where: { id: debt.id }, data: debtUpdate });

    // Şartname §6.2: paying an instalment also books the matching expense.
    let expense = null;
    if (input.createExpense) {
      const categoryId =
        input.expenseCategoryId ?? (await resolveDebtExpenseCategoryId(tx, userId));
      if (categoryId) {
        expense = await tx.expense.create({
          data: {
            userId,
            categoryId,
            amount,
            date: paidAt,
            merchant: debt.title,
            paymentMethod: input.method === "OTOMATIK_ODEME" ? "OTOMATIK_ODEME" : input.method,
            relatedDebtId: debt.id,
            note: input.note ?? `${debt.title} borç ödemesi`,
          },
        });
      }
    }

    return { success: true, payment, installment, expense, paidInstallments: paidCount };
  });
}

/** Finds the "Borç Ödemesi" expense category, falling back to any expense category. */
async function resolveDebtExpenseCategoryId(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<string | null> {
  const preferred = await tx.category.findFirst({
    where: { userId, type: "GIDER", name: { contains: "Borç", mode: "insensitive" }, parentId: null },
    select: { id: true },
  });
  if (preferred) return preferred.id;

  const any = await tx.category.findFirst({
    where: { userId, type: "GIDER" },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  return any?.id ?? null;
}

/** Soft delete (şartname §11). */
export async function archiveDebt(userId: string, id: string) {
  const result = await prisma.debt.updateMany({
    where: { id, userId, isArchived: false },
    data: { isArchived: true },
  });
  if (result.count === 0) throw new NotFoundError("Borç kaydı bulunamadı veya zaten arşivde");
  return true;
}

export async function restoreDebt(userId: string, id: string) {
  const result = await prisma.debt.updateMany({
    where: { id, userId, isArchived: true },
    data: { isArchived: false },
  });
  if (result.count === 0) throw new NotFoundError("Arşivde borç kaydı bulunamadı");
  return true;
}

/** Permanent removal - the API asks for a second confirmation before calling this. */
export async function deleteDebtPermanently(userId: string, id: string) {
  const result = await prisma.debt.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError("Borç kaydı bulunamadı");
  return true;
}
