import { redirect } from "next/navigation";
import { endOfMonth, startOfMonth } from "date-fns";
import { getCurrentSession } from "@/lib/auth";
import { getDebts } from "@/lib/db/debts";
import { getIncomes, getExpenses, getCashBalance } from "@/lib/db/transactions";
import { getSettings } from "@/lib/db/settings";
import { getGoldPrices } from "@/lib/gold/goldService";
import { getAnalyticsSummary } from "@/lib/db/reports";
import { buildPortfolioSummary } from "@/lib/finance/debtValuation";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import type { GoldSyncResult } from "@/lib/gold/types";
import type { LivePayload } from "@/lib/hooks/useLivePortfolio";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

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

  // Gold prices may be unavailable; the UI shows a warning band rather than
  // falling back to invented figures.
  let gold: GoldSyncResult | null = null;
  let goldError: string | null = null;
  try {
    gold = await getGoldPrices();
  } catch (error) {
    goldError = error instanceof Error ? error.message : "Altın fiyatları alınamadı.";
  }

  const portfolio = buildPortfolioSummary(debts, gold, settings, now);

  let analyticsSummary = null;
  try {
    analyticsSummary = await getAnalyticsSummary(session.userId, now);
  } catch (error) {
    console.error("Analitik özet hesaplanamadı:", error);
  }

  const incomeTL = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
  const expenseTL = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Same shape /api/live returns, so the first paint is already correct and the
  // client hook just keeps it fresh from there.
  const initialLive: LivePayload = {
    serverTime: now.toISOString(),
    totals: {
      cashBalanceTL: cash.balanceTL,
      totalIncomeAllTimeTL: cash.totalIncomeTL,
      totalExpenseAllTimeTL: cash.totalExpenseTL,
      totalDebtTL: portfolio.totalDebtTL,
      goldDebtTL: portfolio.goldDebtTL,
      bankDebtTL: portfolio.bankDebtTL,
      accruedInterestTL: portfolio.totalAccruedInterestTL,
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
  };

  const kmhDebts = portfolio.valuations
    .filter((v) => v.type === "EK_HESAP_KMH" && (v.overdraftDetail?.usedAmount ?? 0) > 0)
    .map((v) => ({
      id: v.id,
      title: v.title,
      usedAmount: v.overdraftDetail!.usedAmount,
      limit: v.overdraftDetail!.limit,
      utilizationPercent: v.overdraftDetail!.utilizationPercent,
      accruedInterestTL: v.accruedInterestTL,
      dailyAccrualTL: v.dailyAccrualTL,
      accrualDays: v.overdraftDetail!.accrualDays,
      lastInterestChargeDate: v.overdraftDetail!.lastInterestChargeDate,
      institutionName: v.institutionName,
    }));

  const goldDebts = portfolio.valuations
    .filter((v) => v.type === "ALTIN_BORCU")
    .map((v) => ({
      id: v.id,
      title: v.title,
      totalTL: v.outstandingTL,
      ...v.goldDetail,
    }));

  // Only loans with a live plan can be simulated.
  const loans = portfolio.valuations
    .filter(
      (v) =>
        v.type === "TAKSITLI_KREDI" &&
        v.outstandingTL > 0 &&
        (v.installmentAmountTL ?? 0) > 0 &&
        (v.remainingInstallments ?? 0) > 0
    )
    .map((v) => ({
      id: v.id,
      title: v.title,
      remainingPrincipal: v.principalTL,
      monthlyPayment: v.installmentAmountTL ?? 0,
      monthlyInterestRatePercent: v.monthlyInterestRatePercent ?? 0,
      remainingMonths: v.remainingInstallments ?? 0,
    }));

  return (
    <DashboardClient
      initialLive={initialLive}
      institutionBreakdown={portfolio.institutionBreakdown}
      kmhDebts={kmhDebts}
      goldDebts={goldDebts}
      analyticsSummary={analyticsSummary}
      loans={loans}
      projectedDebtFreeDate={analyticsSummary?.projectedDebtFreeDate ?? null}
    />
  );
}
