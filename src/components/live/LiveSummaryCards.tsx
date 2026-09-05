"use client";

import Link from "next/link";
import {
  CalendarCheck,
  Coins,
  CreditCard,
  Lightning,
  TrendDown,
  TrendUp,
  Vault,
  WarningOctagon,
} from "@phosphor-icons/react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import type { LiveTotals } from "@/lib/hooks/useLivePortfolio";

interface LiveSummaryCardsProps {
  totals: LiveTotals | null;
  /** Total debt including interest accrued since the last poll. */
  liveTotalDebtTL: number;
  tickedInterestTL: number;
}

function Card({
  label,
  icon,
  tone,
  children,
  footer,
  href,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "debt" | "warn" | "income" | "cyan" | "gold" | "cash";
  children: React.ReactNode;
  footer?: React.ReactNode;
  href?: string;
}) {
  const tones = {
    debt: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    cash: "text-teal-300 bg-teal-500/10 border-teal-500/25",
    warn: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    income: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    gold: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  } as const;

  const body = (
    <div className="glass-card flex h-full min-w-0 flex-col overflow-hidden p-3.5 sm:p-4">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-zinc-400">
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
        <span className={`rounded-lg border p-1.5 ${tones[tone]}`}>{icon}</span>
      </div>
      {children}
      {footer && <div className="mt-2 text-[10px] text-zinc-500">{footer}</div>}
    </div>
  );

  return href ? (
    <Link href={href} className="block active:scale-[0.99] transition-transform">
      {body}
    </Link>
  ) : (
    body
  );
}

function Amount({ value, tone }: { value: number; tone: "debt" | "income" | "neutral" }) {
  const color =
    tone === "debt" ? "text-rose-300" : tone === "income" ? "text-emerald-300" : "text-zinc-50";
  return (
    <span
      className={`block whitespace-nowrap font-mono font-bold leading-none tabular-nums ${color}`}
      /*
       * Kart genisligine gore olceklenen punto. Yedi haneli bir tutar (orn.
       * 1.284.930,55 TL) 375px ekranda iki sutunlu kartta sabit puntoyla
       * satir kiriyordu; clamp bunu tek satirda tutar.
       */
      style={{ fontSize: "clamp(0.95rem, 5.2vw, 1.6rem)" }}
    >
      {formatCurrency(value)}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="glass-card h-[7.5rem] animate-pulse motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

/**
 * The four headline figures, updated live.
 *
 * "Toplam Borç" carries the interest that has accrued since the last poll, so
 * a KMH balance visibly grows while the page is open, and the gold portion is
 * re-priced on every refresh.
 */
export function LiveSummaryCards({
  totals,
  liveTotalDebtTL,
  tickedInterestTL,
}: LiveSummaryCardsProps) {
  if (!totals) return <Skeleton />;

  const cashFlowPositive = totals.cashFlowTL >= 0;

  return (
    <div className="space-y-3">
      {/* En üstte iki başlık rakamı: elde ne var, ne borç var. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card
          label="Kasa · Nakit Bakiye"
          tone="cash"
          icon={<Vault size={17} weight="duotone" />}
          href="/income"
          footer={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-emerald-400">
                +{formatCurrency(totals.totalIncomeAllTimeTL)} gelir
              </span>
              <span className="text-rose-400">
                −{formatCurrency(totals.totalExpenseAllTimeTL)} gider
              </span>
            </span>
          }
        >
          <Amount
            value={totals.cashBalanceTL}
            tone={totals.cashBalanceTL >= 0 ? "income" : "debt"}
          />
          <span className="mt-1.5 text-[10px] text-zinc-400">
            {totals.cashBalanceTL >= 0
              ? "Gelirlerinizden harcanmayan tutar"
              : "Gideriniz gelirinizi aştı"}
          </span>
        </Card>

        <Card
          label="Toplam Borç"
          tone="debt"
        icon={<CreditCard size={17} weight="duotone" />}
        href="/debts"
        footer={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{totals.debtCount} kayıt</span>
            {totals.goldDebtTL > 0 && (
              <span className="text-yellow-500/90">
                altın {formatCurrency(totals.goldDebtTL)}
              </span>
            )}
          </span>
        }
      >
          <Amount value={liveTotalDebtTL} tone="debt" />
          {totals.dailyAccrualTL > 0 && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
              <Lightning size={11} weight="fill" />
              <span className="tabular-nums">+{formatNumber(tickedInterestTL, 4)} ₺ işledi</span>
            </span>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Card
        label={totals.overdueCount > 0 ? "Ödemesi Geçti" : "Bu Ay Ödenecek"}
        tone={totals.overdueCount > 0 ? "warn" : "cyan"}
        icon={
          totals.overdueCount > 0 ? (
            <WarningOctagon size={17} weight="duotone" />
          ) : (
            <CalendarCheck size={17} weight="duotone" />
          )
        }
        href={totals.overdueCount > 0 ? "/overdue" : "/calendar"}
        footer={
          totals.overdueCount > 0 ? (
            <span className="font-semibold text-rose-400">
              {totals.overdueCount} kalem · en eskisi {totals.worstOverdueDays} gün gecikti
            </span>
          ) : (
            <span>Vadesi bu ay, ödenmemiş</span>
          )
        }
      >
        <Amount
          value={totals.overdueCount > 0 ? totals.overdueTL : totals.dueThisMonthTL}
          tone={totals.overdueCount > 0 ? "debt" : "neutral"}
        />
        {totals.overdueCount > 0 && (
          <span className="mt-1.5 text-[10px] text-zinc-400">
            Bu ay toplam {formatCurrency(totals.dueThisMonthTL)}
          </span>
        )}
      </Card>

      <Card
        label="Bu Ay Net"
        tone="income"
        icon={<TrendUp size={17} weight="duotone" />}
        href="/income"
        footer={
          <span className="flex items-center gap-2">
            <span className="text-emerald-400">+{formatCurrency(totals.incomeTL)}</span>
            <span className="text-rose-400">−{formatCurrency(totals.expenseTL)}</span>
          </span>
        }
      >
        <Amount value={totals.netTL} tone={totals.netTL >= 0 ? "income" : "debt"} />
      </Card>

      <Card
        label="Nakit Akışı"
        tone={cashFlowPositive ? "cyan" : "warn"}
        icon={
          cashFlowPositive ? (
            <Coins size={17} weight="duotone" />
          ) : (
            <TrendDown size={17} weight="duotone" />
          )
        }
        footer={<span>Gelir − (Gider + Borç)</span>}
      >
        <Amount value={totals.cashFlowTL} tone={cashFlowPositive ? "income" : "debt"} />
        <span
          className={`mt-1.5 text-[10px] font-medium ${
            cashFlowPositive ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {cashFlowPositive ? "Pozitif denge" : "Açık var"}
        </span>
      </Card>
      </div>
    </div>
  );
}
