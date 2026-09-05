import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getDebts } from "@/lib/db/debts";
import { getIncomes, getExpenses, getCashBalance } from "@/lib/db/transactions";
import { getSettings } from "@/lib/db/settings";
import { getGoldPrices } from "@/lib/gold/goldService";
import { buildPortfolioSummary } from "@/lib/finance/debtValuation";
import { errorResponse } from "@/lib/api/handler";
import type { GoldSyncResult } from "@/lib/gold/types";
import { endOfMonth, startOfMonth } from "date-fns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Compact payload the client polls to keep totals live.
 *
 * Everything the header strip and the summary cards need in one round trip:
 * re-priced gold, currency rates, the derived ounce quote, portfolio totals and
 * the overdue list. Kept small on purpose - it is fetched every minute.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [debts, incomes, expenses, settings, cash] = await Promise.all([
      getDebts(session.userId),
      getIncomes(session.userId, { from: monthStart, to: monthEnd }),
      getExpenses(session.userId, { from: monthStart, to: monthEnd }),
      getSettings(session.userId),
      getCashBalance(session.userId),
    ]);

    let gold: GoldSyncResult | null = null;
    let goldError: string | null = null;
    try {
      gold = await getGoldPrices();
    } catch (error) {
      goldError = error instanceof Error ? error.message : "Altın fiyatları alınamadı.";
    }

    const portfolio = buildPortfolioSummary(debts, gold, settings, now);

    const incomeTL = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const expenseTL = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return NextResponse.json(
      {
        serverTime: now.toISOString(),
        totals: {
          cashBalanceTL: cash.balanceTL,
          totalIncomeAllTimeTL: cash.totalIncomeTL,
          totalExpenseAllTimeTL: cash.totalExpenseTL,
          totalDebtTL: portfolio.totalDebtTL,
          goldDebtTL: portfolio.goldDebtTL,
          accruedInterestTL: portfolio.totalAccruedInterestTL,
          // TL accruing per day across every revolving balance; the client
          // divides this down to seconds for the live counter.
          dailyAccrualTL: portfolio.totalDailyAccrualTL,
          dueThisMonthTL: portfolio.dueThisMonthTL,
          overdueTL: portfolio.overdueTL,
          overdueCount: portfolio.overdueCount,
          worstOverdueDays: portfolio.worstOverdueDays,
          debtCount: debts.length,
          incomeTL,
          expenseTL,
          netTL: incomeTL - expenseTL,
          cashFlowTL: incomeTL - expenseTL - portfolio.dueThisMonthTL,
        },
        market: gold
          ? {
              pureGramSellTL: gold.pureGramSellTL,
              pureGramBuyTL: gold.pureGramBuyTL,
              pureGramChangePercent: gold.pureGramChangePercent,
              ounce: gold.ounce,
              currencies: gold.currencies,
              prices: gold.prices,
              // Kullanicinin marjlari: serit, odenecek gercek fiyati gosterebilsin.
              margins: settings.goldMargins,
              source: gold.source,
              sourceKind: gold.sourceKind,
              fetchedAt: gold.fetchedAt,
              providerUpdatedAt: gold.providerUpdatedAt,
              ageMinutes: gold.ageMinutes,
              warning: gold.warning,
            }
          : null,
        goldError,
        overduePayments: portfolio.overduePayments,
        upcomingPayments: portfolio.upcomingPayments.slice(0, 12),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
