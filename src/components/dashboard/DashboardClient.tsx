"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bank,
  ArrowRight,
  PlusCircle,
  CaretDown,
  WarningOctagon,
} from "@phosphor-icons/react";
import { OverdraftLiveTicker, type OverdraftDebtSummary } from "./OverdraftLiveTicker";
import { GoldLiveRateCard, type GoldDebtSummary } from "./GoldLiveRateCard";
import { DebtTrajectoryChart } from "./DebtTrajectoryChart";
import { ExpenseCategoryDonut } from "./ExpenseCategoryDonut";
import { ScenarioSimulatorCard } from "./ScenarioSimulatorCard";
import { LiveMarketStrip } from "@/components/live/LiveMarketStrip";
import { LiveSummaryCards } from "@/components/live/LiveSummaryCards";
import { OverdueList } from "@/components/live/OverdueList";
import { UpcomingList } from "@/components/live/UpcomingList";
import { InstitutionLogo } from "@/components/shared/InstitutionLogo";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useLiveData } from "@/components/live/LiveDataProvider";
import type { LivePayload } from "@/lib/hooks/useLivePortfolio";
import type { InstitutionBreakdown } from "@/lib/finance/debtValuation";
import type { AnalyticsSummary } from "@/lib/db/reports";
import type { LoanProjectionInput } from "@/lib/finance/scenarioProjection";

interface DashboardClientProps {
  initialLive: LivePayload;
  institutionBreakdown: InstitutionBreakdown[];
  kmhDebts?: OverdraftDebtSummary[];
  goldDebts?: GoldDebtSummary[];
  analyticsSummary?: AnalyticsSummary | null;
  loans?: Array<LoanProjectionInput & { remainingMonths: number }>;
  projectedDebtFreeDate: string | null;
}

const DEBT_TYPE_LABELS: Record<string, string> = {
  TAKSITLI_KREDI: "Taksitli Kredi",
  KREDI_KARTI: "Kredi Kartı",
  EK_HESAP_KMH: "KMH / Ek Hesap",
  ALTIN_BORCU: "Altın Borcu",
  KISI_BORCU: "Kişi Borcu",
  SENET_CEK: "Senet / Çek",
  DUZENLI_ODEME: "Düzenli Ödeme",
  DIGER: "Diğer",
};

export function DashboardClient({
  initialLive,
  institutionBreakdown,
  kmhDebts = [],
  goldDebts = [],
  analyticsSummary,
  loans = [],
  projectedDebtFreeDate,
}: DashboardClientProps) {
  // Server-rendered payload paints immediately; the shared provider keeps it
  // live from there, so there is exactly one poll for the whole app.
  const live = useLiveData();
  const data = live?.data ?? null;
  const isRefreshing = live?.isRefreshing ?? false;
  const error = live?.error ?? null;
  const lastUpdatedAt = live?.lastUpdatedAt ?? null;
  const refresh = live?.refresh ?? (async () => {});
  const tickedInterestTL = live?.tickedInterestTL ?? 0;
  const liveTotalDebtTL =
    (data?.totals.totalDebtTL ?? initialLive.totals.totalDebtTL) + tickedInterestTL;
  // Sayfa açıldığından beri değil, son ödemeden beri işlemiş faiz.
  const liveAccruedInterestTL =
    (data?.totals.accruedInterestTL ?? initialLive.totals.accruedInterestTL) +
    tickedInterestTL;

  const [openInstitution, setOpenInstitution] = useState<string | null>(null);

  const totals = data?.totals ?? initialLive.totals;
  const market = data?.market ?? initialLive.market;
  const goldError = data?.goldError ?? initialLive.goldError;
  const overduePayments = data?.overduePayments ?? initialLive.overduePayments;
  const upcomingPayments = (data?.upcomingPayments ?? initialLive.upcomingPayments).filter(
    (p) => !p.isOverdue
  );

  return (
    <div className="space-y-5 pb-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Finansal Bakış
          </h1>
          <p className="mt-0.5 text-[11px] text-zinc-400 sm:text-xs">
            Canlı borç, kur ve altın takibi
          </p>
        </div>

        <Link
          href="/debts/new"
          className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 text-xs font-bold text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition active:scale-95"
        >
          <PlusCircle size={17} weight="bold" />
          <span>Borç Ekle</span>
        </Link>
      </header>

      {/* Canlı kur / altın / ONS şeridi */}
      <LiveMarketStrip
        market={market}
        error={error ?? goldError}
        isRefreshing={isRefreshing}
        onRefresh={() => void refresh(true)}
        lastUpdatedAt={lastUpdatedAt}
      />

      {/* Canlı özet kartları */}
      <LiveSummaryCards
        totals={totals}
        liveTotalDebtTL={liveTotalDebtTL}
        liveAccruedInterestTL={liveAccruedInterestTL}
      />

      {/* Ödemesi geçmiş kalemler - en üstte, çünkü acil olan bu */}
      {overduePayments.length > 0 && (
        <section aria-labelledby="overdue-heading">
          <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
            <h2
              id="overdue-heading"
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-300"
            >
              <WarningOctagon size={14} weight="fill" />
              Ödemesi geçti — ödeme yapılmadı
            </h2>
            <Link
              href="/overdue"
              className="flex items-center gap-1 text-[11px] font-medium text-rose-300 hover:text-rose-200"
            >
              Tümü <ArrowRight size={12} />
            </Link>
          </div>
          <OverdueList
            payments={overduePayments}
            limit={4}
            onPaid={() => void refresh(true)}
          />
        </section>
      )}

      {kmhDebts.length > 0 && (
        <OverdraftLiveTicker
          kmhDebts={kmhDebts}
          totalDailyAccrualTL={totals.dailyAccrualTL}
        />
      )}

      <GoldLiveRateCard
        goldDebts={goldDebts}
        status={
          market
            ? {
                source: market.source,
                sourceKind: market.sourceKind,
                fetchedAt: market.fetchedAt,
                warning: market.warning,
                ageMinutes: market.ageMinutes,
                pureGramSellTL: market.pureGramSellTL,
                prices: market.prices,
                margins: market.margins,
              }
            : null
        }
        error={goldError}
        liveGoldDebtTL={totals.goldDebtTL}
      />

      {analyticsSummary && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DebtTrajectoryChart
              data={analyticsSummary.monthlyProjection12Months}
              projectedDebtFreeDate={projectedDebtFreeDate}
            />
          </div>
          <ExpenseCategoryDonut
            categories={analyticsSummary.expenseCategoryBreakdown}
            totalExpenseTL={analyticsSummary.totalMonthlyExpenseTL}
            previousTotalTL={analyticsSummary.previousMonthExpenseTL}
            totalChangePercent={analyticsSummary.expenseChangePercent}
          />
        </div>
      )}

      {loans.length > 0 && <ScenarioSimulatorCard loans={loans} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Kurum bazlı kırılım - açılınca o kurumdaki her borç ayrı satır */}
        <section className="glass-card p-4 sm:p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Bank size={18} className="text-emerald-400" />
              Kurum Bazlı Dağılım
            </h2>
            <span className="text-[10px] text-zinc-500">detay için dokunun</span>
          </div>

          {institutionBreakdown.length > 0 ? (
            <ul className="space-y-2">
              {institutionBreakdown.map((inst) => {
                const isOpen = openInstitution === inst.institutionId;
                return (
                  <li
                    key={inst.institutionId}
                    className="overflow-hidden rounded-xl border border-white/6 bg-white/[0.02]"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenInstitution(isOpen ? null : inst.institutionId)}
                      className="flex w-full items-center justify-between gap-2.5 p-3 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
                    >
                      <InstitutionLogo
                        name={inst.institutionName}
                        color={inst.color}
                        size={40}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-zinc-100">
                          {inst.institutionName}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {inst.debtCount} kayıt · bu ay {formatCurrency(inst.monthlyObligationTL)}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="font-mono text-[13px] font-bold tabular-nums text-rose-300">
                          {formatCurrency(inst.totalOutstandingTL)}
                        </span>
                        <CaretDown
                          size={14}
                          className={`text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>

                    {isOpen && (
                      <ul className="divide-y divide-white/5 border-t border-white/5 bg-black/25">
                        {inst.debts.map((d) => (
                          <li key={d.id}>
                            <Link
                              href={`/debts/${d.id}`}
                              className="flex items-center justify-between gap-2 p-3 transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
                            >
                              <div className="min-w-0">
                                <span className="block truncate text-xs font-medium text-zinc-200">
                                  {d.title}
                                  {d.isOverdue && (
                                    <span className="ml-1.5 rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                                      GECİKMİŞ
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-zinc-500">
                                  {DEBT_TYPE_LABELS[d.type] ?? d.type}
                                  {d.monthlyInterestRatePercent != null &&
                                    ` · aylık ${formatPercent(d.monthlyInterestRatePercent)}`}
                                  {d.remainingInstallments != null &&
                                    d.totalInstallments != null &&
                                    ` · ${d.remainingInstallments}/${d.totalInstallments} taksit`}
                                  {d.paymentDayOfMonth != null && ` · ayın ${d.paymentDayOfMonth}.`}
                                </span>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="block font-mono text-xs font-semibold tabular-nums text-zinc-100">
                                  {formatCurrency(d.outstandingTL)}
                                </span>
                                {d.installmentAmountTL != null && (
                                  <span className="text-[10px] text-zinc-500">
                                    taksit {formatCurrency(d.installmentAmountTL)}
                                  </span>
                                )}
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
              <Bank size={32} className="mx-auto mb-2 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-300">Henüz borç kaydı yok</p>
              <p className="mx-auto mt-1 max-w-sm text-[11px] text-zinc-500">
                Bankalarınızdaki kredileri, kartları ve altın borçlarınızı ekleyerek başlayın.
              </p>
              <Link
                href="/debts/new"
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-xs font-semibold text-white transition active:scale-95"
              >
                <PlusCircle size={16} />
                İlk borcunu ekle
              </Link>
            </div>
          )}
        </section>

        <section className="glass-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Yaklaşan Ödemeler</h2>
            <span className="text-[10px] text-zinc-500">30 gün</span>
          </div>

          <UpcomingList payments={upcomingPayments} limit={8} />

          <Link
            href="/calendar"
            className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white/5 text-xs font-medium text-emerald-400 transition active:scale-[0.98]"
          >
            Takvimi aç <ArrowRight size={13} />
          </Link>
        </section>
      </div>
    </div>
  );
}
