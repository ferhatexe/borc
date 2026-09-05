"use client";

import { useState } from "react";
import Link from "next/link";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import {
  CreditCard,
  CalendarCheck,
  TrendUp,
  Lightning,
  Bank,
  ArrowRight,
  PlusCircle,
  CaretDown,
  WarningCircle,
  Clock,
} from "@phosphor-icons/react";
import { OverdraftLiveTicker, type OverdraftDebtSummary } from "./OverdraftLiveTicker";
import { GoldLiveRateCard, type GoldStatus, type GoldDebtSummary } from "./GoldLiveRateCard";
import { DebtTrajectoryChart } from "./DebtTrajectoryChart";
import { ExpenseCategoryDonut } from "./ExpenseCategoryDonut";
import { ScenarioSimulatorCard } from "./ScenarioSimulatorCard";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
import type { InstitutionBreakdown, UpcomingPayment } from "@/lib/finance/debtValuation";
import type { AnalyticsSummary } from "@/lib/db/reports";
import type { LoanProjectionInput } from "@/lib/finance/scenarioProjection";

interface DashboardClientProps {
  totalDebtTL: number;
  totalAccruedInterestTL: number;
  totalDailyAccrualTL: number;
  debtsCount: number;
  thisMonthPayableTL: number;
  overdueTL: number;
  thisMonthIncomeTL: number;
  thisMonthExpenseTL: number;
  institutionBreakdown: InstitutionBreakdown[];
  upcomingPayments: UpcomingPayment[];
  kmhDebts?: OverdraftDebtSummary[];
  goldDebts?: GoldDebtSummary[];
  goldStatus: GoldStatus | null;
  goldError: string | null;
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
  totalDebtTL,
  totalAccruedInterestTL,
  totalDailyAccrualTL,
  debtsCount,
  thisMonthPayableTL,
  overdueTL,
  thisMonthIncomeTL,
  thisMonthExpenseTL,
  institutionBreakdown,
  upcomingPayments,
  kmhDebts = [],
  goldDebts = [],
  goldStatus,
  goldError,
  analyticsSummary,
  loans = [],
  projectedDebtFreeDate,
}: DashboardClientProps) {
  const netCashFlow = thisMonthIncomeTL - (thisMonthExpenseTL + thisMonthPayableTL);
  const [openInstitution, setOpenInstitution] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Finansal Bakış
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Anlık borç durumu, yaklaşan vadeler ve nakit akışınız.
          </p>
        </div>

        <Link
          href="/debts/new"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all hover:brightness-110 touch-feedback"
        >
          <PlusCircle size={18} weight="bold" />
          <span>Borç Ekle</span>
        </Link>
      </div>

      {/* Altın fiyatları eski veya alınamıyorsa açıkça uyar (şartname §7). */}
      {(goldError || goldStatus?.warning) && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200"
        >
          <WarningCircle size={18} weight="fill" className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Altın fiyat uyarısı</p>
            <p className="text-amber-200/80 mt-0.5">{goldError ?? goldStatus?.warning}</p>
            <Link href="/settings" className="mt-1 inline-block underline hover:text-amber-100">
              Ayarlardan manuel fiyat girebilirsiniz
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Toplam Borç</span>
            <div className="rounded-lg bg-red-500/10 p-2 text-red-400 border border-red-500/20">
              <CreditCard size={20} weight="duotone" />
            </div>
          </div>
          <MoneyDisplay amount={totalDebtTL} type="debt" size="xl" />
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
            <span>{debtsCount} aktif borç kaydı</span>
            {totalAccruedInterestTL > 0 && (
              <span className="text-amber-400/90" title="Henüz tahakkuk etmemiş işleyen faiz">
                +{formatCurrency(totalAccruedInterestTL)} işleyen faiz
              </span>
            )}
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Bu Ay Ödenecek</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400 border border-amber-500/20">
              <CalendarCheck size={20} weight="duotone" />
            </div>
          </div>
          <MoneyDisplay amount={thisMonthPayableTL} type="neutral" size="xl" />
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Vadesi bu ay, ödenmemiş</span>
            {overdueTL > 0 && (
              <span className="text-red-400 font-semibold">
                {formatCurrency(overdueTL)} gecikmiş
              </span>
            )}
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Bu Ay Net Gelir</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
              <TrendUp size={20} weight="duotone" />
            </div>
          </div>
          <MoneyDisplay amount={thisMonthIncomeTL - thisMonthExpenseTL} type="income" size="xl" />
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
            <span className="text-emerald-400">{formatCurrency(thisMonthIncomeTL)} gelir</span>
            <span className="text-red-400">{formatCurrency(thisMonthExpenseTL)} gider</span>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Nakit Akışı</span>
            <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400 border border-cyan-500/20">
              <Lightning size={20} weight="duotone" />
            </div>
          </div>
          <MoneyDisplay amount={netCashFlow} type={netCashFlow >= 0 ? "income" : "debt"} size="xl" />
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Gelir − (Gider + Borç)</span>
            <span className={netCashFlow >= 0 ? "text-emerald-400" : "text-red-400"}>
              {netCashFlow >= 0 ? "Pozitif denge" : "Açık var"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {kmhDebts.length > 0 && (
          <OverdraftLiveTicker kmhDebts={kmhDebts} totalDailyAccrualTL={totalDailyAccrualTL} />
        )}
        <GoldLiveRateCard goldDebts={goldDebts} status={goldStatus} error={goldError} />
      </div>

      {analyticsSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DebtTrajectoryChart
              data={analyticsSummary.monthlyProjection12Months}
              projectedDebtFreeDate={projectedDebtFreeDate}
            />
          </div>
          <div>
            <ExpenseCategoryDonut
              categories={analyticsSummary.expenseCategoryBreakdown}
              totalExpenseTL={analyticsSummary.totalMonthlyExpenseTL}
            />
          </div>
        </div>
      )}

      {loans.length > 0 && <ScenarioSimulatorCard loans={loans} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Kurum bazlı kırılım - açılınca o kurumdaki her borç ayrı satır (§6.1) */}
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bank size={20} className="text-emerald-400" />
              <h3 className="text-base font-semibold text-white">Kurum Bazlı Dağılım</h3>
            </div>
            <span className="text-xs text-zinc-400">Detay için tıklayın</span>
          </div>

          {institutionBreakdown.length > 0 ? (
            <div className="space-y-3">
              {institutionBreakdown.map((inst) => {
                const isOpen = openInstitution === inst.institutionId;
                return (
                  <div
                    key={inst.institutionId}
                    className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenInstitution(isOpen ? null : inst.institutionId)}
                      className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[10px] font-bold text-white"
                          style={{ backgroundColor: `${inst.color}33` }}
                        >
                          {inst.institutionName.slice(0, 3).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-zinc-200 text-sm">
                            {inst.institutionName}
                          </div>
                          <div className="text-xs text-zinc-400">
                            {inst.debtCount} kayıt · bu ay{" "}
                            {formatCurrency(inst.monthlyObligationTL)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-sm font-semibold text-red-300 tabular-nums">
                          {formatCurrency(inst.totalOutstandingTL)}
                        </span>
                        <CaretDown
                          size={16}
                          className={`text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-white/5 bg-black/20 divide-y divide-white/5">
                        {inst.debts.map((d) => (
                          <Link
                            key={d.id}
                            href={`/debts/${d.id}`}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs transition-colors hover:bg-white/[0.04]"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium text-zinc-200">
                                {d.title}
                                {d.isOverdue && (
                                  <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
                                    GECİKMİŞ
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-[11px] text-zinc-500">
                                {DEBT_TYPE_LABELS[d.type] ?? d.type}
                                {d.monthlyInterestRatePercent != null &&
                                  ` · aylık ${formatPercent(d.monthlyInterestRatePercent)}`}
                                {d.remainingInstallments != null &&
                                  d.totalInstallments != null &&
                                  ` · ${d.remainingInstallments}/${d.totalInstallments} taksit kaldı`}
                                {d.paymentDayOfMonth != null &&
                                  ` · ayın ${d.paymentDayOfMonth}. günü`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-semibold text-zinc-100 tabular-nums">
                                {formatCurrency(d.outstandingTL)}
                              </div>
                              {d.installmentAmountTL != null && (
                                <div className="text-[11px] text-zinc-500">
                                  taksit {formatCurrency(d.installmentAmountTL)}
                                </div>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
              <Bank size={36} className="mx-auto text-zinc-600 mb-2" />
              <div className="text-sm font-medium text-zinc-300">Henüz borç kaydı yok</div>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Bankalarınızdaki kredileri, kartları ve altın borçlarınızı ekleyerek başlayın.
              </p>
              <Link
                href="/debts/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/15 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
              >
                <PlusCircle size={16} />
                <span>İlk borcunu ekle</span>
              </Link>
            </div>
          )}
        </div>

        {/* Gerçek yaklaşan ödeme zaman çizelgesi (§6.1) */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Yaklaşan Ödemeler</h3>
            <span className="text-xs text-zinc-500">30 gün</span>
          </div>

          {upcomingPayments.length > 0 ? (
            <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {upcomingPayments.slice(0, 25).map((p) => (
                <li key={`${p.debtId}-${p.installmentId ?? p.dueDate}`}>
                  <Link
                    href={`/debts/${p.debtId}`}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-xs transition-colors ${
                      p.isOverdue
                        ? "border-red-500/40 bg-red-500/10 hover:bg-red-500/15"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-200">{p.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <Clock size={12} />
                        <span>{formatDate(p.dueDate)}</span>
                        <span className={p.isOverdue ? "text-red-400 font-semibold" : ""}>
                          {p.isOverdue
                            ? `${Math.abs(p.daysUntilDue)} gün gecikti`
                            : p.daysUntilDue === 0
                              ? "bugün"
                              : `${p.daysUntilDue} gün kaldı`}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 font-mono font-semibold tabular-nums ${
                        p.isOverdue ? "text-red-300" : "text-zinc-100"
                      }`}
                    >
                      {formatCurrency(p.amountTL)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
              <CalendarCheck size={32} className="mx-auto text-zinc-600 mb-2" />
              <div className="text-xs font-medium text-zinc-400">
                Önümüzdeki 30 günde ödeme yok
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Taksitli kredi veya düzenli ödeme eklediğinizde burada listelenir.
              </p>
            </div>
          )}

          <Link
            href="/calendar"
            className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-white/5 py-2 text-xs font-medium text-emerald-400 transition-colors hover:bg-white/10"
          >
            <span>Takvimi aç</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
