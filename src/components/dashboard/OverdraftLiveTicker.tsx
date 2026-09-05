"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Lightning, ArrowRight, Vault } from "@phosphor-icons/react";
import { formatCurrency, formatDate } from "@/lib/formatters";

export interface OverdraftDebtSummary {
  id: string;
  title: string;
  usedAmount: number;
  limit: number;
  utilizationPercent: number;
  /** Interest accrued since the last charge date, already tax inclusive. */
  accruedInterestTL: number;
  /** TL accruing per day at the current balance. */
  dailyAccrualTL: number;
  accrualDays: number;
  lastInterestChargeDate: string | null;
  institutionName?: string | null;
}

interface OverdraftLiveTickerProps {
  kmhDebts: OverdraftDebtSummary[];
  /** Total daily accrual across every KMH account, computed on the server. */
  totalDailyAccrualTL: number;
}

/** Honours the OS "reduce motion" preference (şartname §2). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}

/**
 * Live KMH interest counter.
 *
 * The accrued figure comes from the server, calculated from each account's
 * `lastInterestChargeDate` - the ticker only animates the seconds that have
 * passed since the page loaded, on top of that real balance.
 */
export function OverdraftLiveTicker({ kmhDebts, totalDailyAccrualTL }: OverdraftLiveTickerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Render sirasinda Date.now() cagirmak saf olmayan bir islemdir; mount aninda doldurulur.
  const mountedAt = useRef<number | null>(null);

  const totals = useMemo(() => {
    const totalUsed = kmhDebts.reduce((s, d) => s + d.usedAmount, 0);
    const totalLimit = kmhDebts.reduce((s, d) => s + d.limit, 0);
    const accruedSoFar = kmhDebts.reduce((s, d) => s + d.accruedInterestTL, 0);
    return {
      totalUsed,
      totalLimit,
      accruedSoFar,
      perSecond: totalDailyAccrualTL / 86400,
      perMinute: totalDailyAccrualTL / 1440,
      monthly: totalDailyAccrualTL * 30,
    };
  }, [kmhDebts, totalDailyAccrualTL]);

  useEffect(() => {
    if (totals.totalUsed <= 0) return;
    // With reduced motion the counter still updates, just once a second rather
    // than ten times a second.
    const intervalMs = reducedMotion ? 1000 : 250;
    if (mountedAt.current === null) mountedAt.current = Date.now();
    const startedAt = mountedAt.current;

    const timer = setInterval(() => {
      setElapsedSeconds((Date.now() - startedAt) / 1000);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [totals.totalUsed, reducedMotion]);

  if (kmhDebts.length === 0 || totals.totalUsed <= 0) return null;

  const sessionAccrued = totals.perSecond * elapsedSeconds;
  const liveTotal = totals.accruedSoFar + sessionAccrued;

  return (
    <section
      aria-label="Canlı KMH faiz sayacı"
      className="relative overflow-hidden p-5 rounded-3xl bg-gradient-to-br from-amber-950/40 via-zinc-900/90 to-zinc-950 border border-amber-500/30 shadow-[0_0_35px_rgba(245,158,11,0.15)] space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            {!reducedMotion && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            )}
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
          <div className="flex items-center gap-1.5">
            <Lightning size={18} weight="fill" className="text-amber-400" />
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Canlı KMH / Ek Hesap Faiz Sayacı
            </span>
          </div>
        </div>
        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
          Gün bazında tahakkuk
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-1">
          <span className="text-[11px] text-zinc-400">Toplam eksi bakiye</span>
          <p className="text-xl font-bold text-white font-mono tabular-nums">
            {formatCurrency(totals.totalUsed)}
          </p>
          <span className="text-[10px] text-zinc-500">
            {kmhDebts.length} hesap
            {totals.totalLimit > 0 &&
              ` · limitin %${Math.round((totals.totalUsed / totals.totalLimit) * 100)}'i`}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-1">
          <span className="text-[11px] text-zinc-400">Şu ana kadar işleyen faiz</span>
          <p className="text-xl font-bold text-amber-400 font-mono tabular-nums">
            {liveTotal.toLocaleString("tr-TR", {
              minimumFractionDigits: 4,
              maximumFractionDigits: 4,
            })}{" "}
            ₺
          </p>
          <span className="text-[10px] text-zinc-500">
            Son tahakkuktan bu yana · faiz + KKDF + BSMV
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-1">
          <span className="text-[11px] text-zinc-400">30 günlük faiz yükü</span>
          <p className="text-xl font-bold text-rose-400 font-mono tabular-nums">
            {formatCurrency(totals.monthly)}
          </p>
          <span className="text-[10px] text-zinc-500">Kapatılmazsa ay sonu maliyet</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/40 border border-amber-500/20 text-xs">
        <span className="text-zinc-400">
          Bu sayfada kalınan sürede:{" "}
          <strong className="font-mono font-bold text-amber-400 tabular-nums">
            +{sessionAccrued.toFixed(4)} ₺
          </strong>
        </span>
        <div className="flex items-center gap-4 text-[11px] text-zinc-400">
          <span>
            Saniyede{" "}
            <strong className="text-zinc-200 font-mono tabular-nums">
              {totals.perSecond.toFixed(4)} ₺
            </strong>
          </span>
          <span>
            Dakikada{" "}
            <strong className="text-zinc-200 font-mono tabular-nums">
              {totals.perMinute.toFixed(2)} ₺
            </strong>
          </span>
        </div>
      </div>

      <ul className="space-y-1.5">
        {kmhDebts.map((d) => (
          <li key={d.id}>
            <Link
              href={`/debts/${d.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs transition-colors hover:bg-white/10"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Vault size={14} className="shrink-0 text-amber-400" />
                <span className="truncate text-zinc-200">{d.title}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <span className="font-mono tabular-nums">{formatCurrency(d.usedAmount)}</span>
                <span className="text-amber-300 font-mono tabular-nums">
                  +{formatCurrency(d.accruedInterestTL)}
                </span>
                <span>
                  {d.accrualDays} gün
                  {d.lastInterestChargeDate && ` (${formatDate(d.lastInterestChargeDate)})`}
                </span>
                <ArrowRight size={12} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
