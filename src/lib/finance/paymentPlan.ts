/**
 * Ödeme planı: önümüzdeki aylarda ne ödenecek, eldeki para nereye kadar
 * yeter, peşin kapatılırsa hangi taksitler kalkar.
 *
 * Bu modül öneri vermez. Sıralama ölçütünü kullanıcı seçer; burada yalnızca
 * her seçeneğin rakamları hesaplanır.
 */
import type { DebtWithRelations } from "@/lib/db/debts";
import type { DebtValuation, UpcomingPayment } from "./debtValuation";

export interface PlanPayment {
  key: string;
  debtId: string;
  title: string;
  institutionName: string | null;
  dueDate: string;
  amountTL: number;
  isOverdue: boolean;
}

export interface CoveredPayment extends PlanPayment {
  /** Bu ödemeden sonra elde kalan (eksiye düşmez). */
  cashAfterTL: number;
  /** Bu ödemenin karşılanamayan kısmı; 0 ise tamamı karşılandı. */
  shortTL: number;
}

export interface PlanMonth {
  /** "2026-12" */
  month: string;
  totalTL: number;
  shortTL: number;
  payments: CoveredPayment[];
}

export interface PayoffOption {
  debtId: string;
  title: string;
  institutionName: string | null;
  debtType: string;
  /** Bugün kapatmak için gereken tutar (uygulamanın hesabı). */
  payoffTL: number;
  /** Kalan tüm taksitlerin toplamı; kart ve ek hesapta kapamaya eşittir. */
  futurePaymentsTL: number;
  /** Kalan ödemeler eksi kapama: peşin kapatınca ödenmeyecek faiz ve vergi. */
  interestSavedTL: number;
  /** Ay ay kalkacak ödeme ("2026-12" -> tutar). */
  reliefByMonth: Record<string, number>;
  /** Ek hesaba bağlı ürün: kapanınca limit yeniden kullanılabilir hâle gelir. */
  reopensLimit: boolean;
  nextDueDate: string | null;
  /** Ek hesapta aylık işleyen faiz (yaklaşık); diğerlerinde null. */
  monthlyInterestTL: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** İstanbul takvimine göre "YYYY-MM". */
export function monthKey(date: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(date));
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

/** Bugünden itibaren `months` takvim ayının (bu ay dahil) son gününe kadar kaç gün var. */
export function horizonDaysFor(months: number, now: Date = new Date()): number {
  const end = new Date(now.getFullYear(), now.getMonth() + months, 0, 23, 59, 59);
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

const LIMIT_PRODUCT = /ek\s*hesap|avans|ay\s*sonu|kmh|kredili\s*mevduat/i;

export function reopensLimit(debt: { type: string; title: string }): boolean {
  return debt.type === "EK_HESAP_KMH" || LIMIT_PRODUCT.test(debt.title);
}

export function toPlanPayments(upcoming: UpcomingPayment[]): PlanPayment[] {
  return upcoming
    .map((p) => ({
      key: p.installmentId ?? `${p.debtId}:${p.dueDate}`,
      debtId: p.debtId,
      title: p.title,
      institutionName: p.institutionName,
      dueDate: p.dueDate,
      amountTL: p.amountTL,
      isOverdue: p.isOverdue,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Ödemeleri tarih sırasıyla eldeki paradan düşer ve aylara böler.
 * Peşin kapatılmak üzere seçilen borçların ödemeleri listeden çıkar.
 */
export function coverPayments(
  payments: PlanPayment[],
  cashTL: number,
  excludeDebtIds: ReadonlySet<string> = new Set()
): PlanMonth[] {
  let cash = Math.max(0, cashTL);
  const months = new Map<string, PlanMonth>();

  for (const p of payments) {
    if (excludeDebtIds.has(p.debtId)) continue;
    const paid = Math.min(cash, p.amountTL);
    cash = round2(cash - paid);
    const row: CoveredPayment = { ...p, cashAfterTL: cash, shortTL: round2(p.amountTL - paid) };

    const key = monthKey(p.dueDate);
    const month = months.get(key) ?? { month: key, totalTL: 0, shortTL: 0, payments: [] };
    month.totalTL = round2(month.totalTL + p.amountTL);
    month.shortTL = round2(month.shortTL + row.shortTL);
    month.payments.push(row);
    months.set(key, month);
  }

  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Peşin kapatılabilecek banka borçları ve her birinin rakamları. */
export function buildPayoffOptions(
  debts: DebtWithRelations[],
  valuations: DebtValuation[]
): PayoffOption[] {
  const byId = new Map(valuations.map((v) => [v.id, v]));
  const out: PayoffOption[] = [];

  for (const debt of debts) {
    if (debt.status === "KAPANDI") continue;
    const v = byId.get(debt.id);
    if (!v || v.outstandingTL <= 0) continue;

    const reliefByMonth: Record<string, number> = {};
    let futurePaymentsTL = 0;
    let monthlyInterestTL: number | null = null;

    if (debt.type === "TAKSITLI_KREDI") {
      for (const row of debt.installmentSchedules ?? []) {
        if (row.status === "ODENDI") continue;
        const amount = Number(row.totalAmount);
        futurePaymentsTL += amount;
        const key = monthKey(row.dueDate);
        reliefByMonth[key] = round2((reliefByMonth[key] ?? 0) + amount);
      }
    } else if (debt.type === "KREDI_KARTI") {
      futurePaymentsTL = v.outstandingTL;
      if (v.nextDueDate) reliefByMonth[monthKey(v.nextDueDate)] = v.outstandingTL;
    } else if (debt.type === "EK_HESAP_KMH") {
      futurePaymentsTL = v.outstandingTL;
      monthlyInterestTL = round2(v.dailyAccrualTL * 30);
    } else {
      continue; // altın ve kişi borçları peşin kapama listesine girmez
    }

    out.push({
      debtId: debt.id,
      title: debt.title,
      institutionName: debt.institution?.name ?? null,
      debtType: debt.type,
      payoffTL: round2(v.outstandingTL),
      futurePaymentsTL: round2(futurePaymentsTL),
      interestSavedTL: round2(Math.max(0, futurePaymentsTL - v.outstandingTL)),
      reliefByMonth,
      reopensLimit: reopensLimit(debt),
      nextDueDate: v.nextDueDate,
      monthlyInterestTL,
    });
  }

  return out;
}

export type PayoffSort = "yuk" | "faiz" | "vade";

/**
 * Kullanıcının seçtiği ölçüte göre sıralar:
 *  - yuk:  önümüzdeki `months` ayda kalkan ödeme / kapama tutarı (büyük önce)
 *  - faiz: kurtulan faiz / kapama tutarı (büyük önce)
 *  - vade: sıradaki ödeme tarihi (yakın önce)
 */
export function sortPayoffOptions(
  options: PayoffOption[],
  sort: PayoffSort,
  monthKeys: string[]
): PayoffOption[] {
  const near = (o: PayoffOption) => monthKeys.reduce((s, m) => s + (o.reliefByMonth[m] ?? 0), 0);
  const score = (o: PayoffOption) =>
    sort === "yuk"
      ? near(o) / o.payoffTL
      : sort === "faiz"
        ? (o.interestSavedTL + (o.monthlyInterestTL ?? 0) * monthKeys.length) / o.payoffTL
        : 0;

  return [...options].sort((a, b) => {
    if (sort === "vade") {
      return (a.nextDueDate ?? "9999").localeCompare(b.nextDueDate ?? "9999");
    }
    return score(b) - score(a);
  });
}

export function nearReliefTL(option: PayoffOption, monthKeys: string[]): number {
  return round2(monthKeys.reduce((s, m) => s + (option.reliefByMonth[m] ?? 0), 0));
}
