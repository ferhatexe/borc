import Decimal from "decimal.js";
import { endOfMonth, startOfMonth } from "date-fns";
import { getIncomes, getExpenses } from "./transactions";
import { getDebts } from "./debts";
import { getSettings } from "./settings";
import { getGoldPrices } from "../gold/goldService";
import type { GoldSyncResult } from "../gold/types";
import { buildPortfolioSummary } from "../finance/debtValuation";

export interface CalendarDayEvent {
  id: string;
  type: "INCOME" | "EXPENSE" | "DEBT_INSTALLMENT" | "CREDIT_CARD_DUE" | "RECURRING_PAYMENT" | "DEBT_DUE";
  title: string;
  amount: number;
  date: string;
  status?: string;
  categoryName?: string;
  institutionName?: string;
  color?: string;
  debtId?: string;
  installmentId?: string;
}

export interface DayActivity {
  dayNumber: number;
  dateStr: string;
  inflow: number;
  outflow: number;
  net: number;
  events: CalendarDayEvent[];
}

export interface MonthCalendarData {
  year: number;
  month: number;
  days: Record<number, DayActivity>;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  totalDebtObligation: number;
  goldWarning: string | null;
}

/** How many months apart two consecutive payments of a schedule are. */
function frequencyStepMonths(frequency: string | null | undefined): number {
  switch (frequency) {
    case "YILLIK":
      return 12;
    case "ALTI_AYLIK":
      return 6;
    case "UC_AYLIK":
      return 3;
    default:
      return 1;
  }
}

/**
 * Occurrences of a recurring payment that land inside the requested month.
 * A yearly payment therefore appears once a year, not every single month.
 */
function recurringOccurrencesInMonth(
  anchor: Date,
  frequency: string | null | undefined,
  monthStart: Date,
  monthEnd: Date
): Date[] {
  const step = frequencyStepMonths(frequency);
  const out: Date[] = [];
  const cursor = new Date(anchor);

  // Wind backwards so an anchor in the future still lines up on the grid.
  let guard = 0;
  while (cursor > monthEnd && guard < 600) {
    cursor.setMonth(cursor.getMonth() - step);
    guard += 1;
  }
  guard = 0;
  while (cursor < monthStart && guard < 600) {
    cursor.setMonth(cursor.getMonth() + step);
    guard += 1;
  }
  while (cursor >= monthStart && cursor <= monthEnd) {
    out.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + step);
  }

  return out;
}

export async function getMonthCalendarEvents(
  userId: string,
  year: number,
  month: number
): Promise<MonthCalendarData> {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const totalDaysInMonth = monthEnd.getDate();

  let gold: GoldSyncResult | null = null;
  const [incomes, expenses, debts, settings] = await Promise.all([
    getIncomes(userId, { year, month }),
    getExpenses(userId, { year, month }),
    getDebts(userId),
    getSettings(userId),
  ]);

  try {
    gold = await getGoldPrices();
  } catch {
    gold = null;
  }

  const portfolio = buildPortfolioSummary(debts, gold, settings, monthStart);
  const valuationById = new Map(portfolio.valuations.map((v) => [v.id, v]));

  const days: Record<number, DayActivity> = {};
  for (let d = 1; d <= totalDaysInMonth; d++) {
    days[d] = {
      dayNumber: d,
      dateStr: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      inflow: 0,
      outflow: 0,
      net: 0,
      events: [],
    };
  }

  let totalInflow = new Decimal(0);
  let totalOutflow = new Decimal(0);
  let totalDebtObligation = new Decimal(0);

  /**
   * `direction: "NONE"` marks the day without touching the cash-flow totals -
   * used for instalments that are already paid, because the payment produced an
   * expense row of its own and counting it twice would double the month.
   */
  const addEvent = (day: number, event: CalendarDayEvent, direction: "IN" | "OUT" | "NONE") => {
    const clamped = Math.min(Math.max(day, 1), totalDaysInMonth);
    const bucket = days[clamped];
    const amount = new Decimal(event.amount);

    if (direction === "IN") {
      bucket.inflow = new Decimal(bucket.inflow).plus(amount).toNumber();
      totalInflow = totalInflow.plus(amount);
    } else if (direction === "OUT") {
      bucket.outflow = new Decimal(bucket.outflow).plus(amount).toNumber();
      totalOutflow = totalOutflow.plus(amount);
    }
    bucket.events.push(event);
  };

  for (const inc of incomes) {
    const d = new Date(inc.date);
    addEvent(
      d.getDate(),
      {
        id: inc.id,
        type: "INCOME",
        title: inc.source || inc.category?.name || "Gelir",
        amount: Number(inc.amount),
        date: d.toISOString(),
        categoryName: inc.category?.name,
        color: inc.category?.color ?? "#10b981",
      },
      "IN"
    );
  }

  for (const exp of expenses) {
    const d = new Date(exp.date);
    addEvent(
      d.getDate(),
      {
        id: exp.id,
        type: "EXPENSE",
        title: exp.merchant || exp.category?.name || "Harcama",
        amount: Number(exp.amount),
        date: d.toISOString(),
        categoryName: exp.category?.name,
        color: exp.category?.color ?? "#f43f5e",
        debtId: exp.relatedDebtId ?? undefined,
      },
      "OUT"
    );
  }

  for (const debt of debts) {
    if (debt.status === "KAPANDI") continue;
    const valuation = valuationById.get(debt.id);

    if (debt.type === "TAKSITLI_KREDI") {
      for (const s of debt.installmentSchedules ?? []) {
        const due = new Date(s.dueDate);
        if (due < monthStart || due > monthEnd) continue;

        const amount = Number(s.totalAmount);
        if (s.status !== "ODENDI") totalDebtObligation = totalDebtObligation.plus(amount);

        addEvent(
          due.getDate(),
          {
            id: s.id,
            type: "DEBT_INSTALLMENT",
            title: `${debt.title} (${s.installmentNo}. Taksit)`,
            amount,
            date: due.toISOString(),
            status: s.status,
            institutionName: debt.institution?.name,
            color: debt.institution?.color ?? "#10b981",
            debtId: debt.id,
            installmentId: s.id,
          },
          s.status === "ODENDI" ? "NONE" : "OUT"
        );
      }
      continue;
    }

    if (debt.type === "KREDI_KARTI" && debt.dueDay) {
      const amount = valuation?.dueThisMonthTL ?? 0;
      if (amount > 0) {
        const day = Math.min(debt.dueDay, totalDaysInMonth);
        totalDebtObligation = totalDebtObligation.plus(amount);
        addEvent(
          day,
          {
            id: `card-due-${debt.id}-${year}-${month}`,
            type: "CREDIT_CARD_DUE",
            title: `${debt.title} son ödeme`,
            amount,
            date: new Date(year, month - 1, day).toISOString(),
            institutionName: debt.institution?.name,
            color: "#3b82f6",
            debtId: debt.id,
          },
          "OUT"
        );
      }
      continue;
    }

    if (debt.type === "DUZENLI_ODEME" && debt.amount) {
      const anchor = debt.nextDueDate ? new Date(debt.nextDueDate) : new Date(debt.startDate);
      const amount = Number(debt.amount);
      for (const occurrence of recurringOccurrencesInMonth(
        anchor,
        debt.frequency,
        monthStart,
        monthEnd
      )) {
        totalDebtObligation = totalDebtObligation.plus(amount);
        addEvent(
          occurrence.getDate(),
          {
            id: `recurring-${debt.id}-${occurrence.toISOString().slice(0, 10)}`,
            type: "RECURRING_PAYMENT",
            title: debt.title,
            amount,
            date: occurrence.toISOString(),
            color: debt.institution?.color ?? "#f43f5e",
            debtId: debt.id,
            institutionName: debt.institution?.name,
          },
          "OUT"
        );
      }
      continue;
    }

    // Gold, personal, promissory notes and "other": a single due date.
    if (debt.dueDate) {
      const due = new Date(debt.dueDate);
      if (due < monthStart || due > monthEnd) continue;
      const amount = valuation?.outstandingTL ?? Number(debt.amount ?? 0);
      if (amount <= 0) continue;

      totalDebtObligation = totalDebtObligation.plus(amount);
      addEvent(
        due.getDate(),
        {
          id: `due-${debt.id}`,
          type: "DEBT_DUE",
          title: `${debt.title} vadesi`,
          amount,
          date: due.toISOString(),
          institutionName: debt.institution?.name,
          color: debt.type === "ALTIN_BORCU" ? "#f59e0b" : "#a855f7",
          debtId: debt.id,
        },
        "OUT"
      );
    }
  }

  for (let d = 1; d <= totalDaysInMonth; d++) {
    days[d].net = new Decimal(days[d].inflow).minus(days[d].outflow).toNumber();
    days[d].events.sort((a, b) => a.date.localeCompare(b.date));
  }

  return {
    year,
    month,
    days,
    totalInflow: totalInflow.toNumber(),
    totalOutflow: totalOutflow.toNumber(),
    netCashFlow: totalInflow.minus(totalOutflow).toNumber(),
    totalDebtObligation: totalDebtObligation.toNumber(),
    goldWarning: gold?.warning ?? null,
  };
}
