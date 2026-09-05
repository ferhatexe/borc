"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CurrencyRate, GoldPriceRecord, OunceQuote } from "@/lib/gold/types";
import type { UpcomingPayment } from "@/lib/finance/debtValuation";

export interface LiveTotals {
  /** Kasadaki nakit: tüm zamanların geliri eksi gideri. */
  cashBalanceTL: number;
  totalIncomeAllTimeTL: number;
  totalExpenseAllTimeTL: number;
  totalDebtTL: number;
  goldDebtTL: number;
  accruedInterestTL: number;
  dailyAccrualTL: number;
  dueThisMonthTL: number;
  overdueTL: number;
  overdueCount: number;
  worstOverdueDays: number;
  debtCount: number;
  incomeTL: number;
  expenseTL: number;
  netTL: number;
  cashFlowTL: number;
}

export interface LiveMarket {
  pureGramSellTL: number;
  pureGramBuyTL: number;
  pureGramChangePercent: number | null;
  ounce: OunceQuote | null;
  currencies: CurrencyRate[];
  prices: GoldPriceRecord[];
  /** Ürün başına TL marj (Ayarlar > Altın Marjları). */
  margins: Record<string, number>;
  source: string;
  sourceKind: string;
  fetchedAt: string;
  providerUpdatedAt: string | null;
  ageMinutes: number;
  warning: string | null;
}

export interface LivePayload {
  serverTime: string;
  totals: LiveTotals;
  market: LiveMarket | null;
  goldError: string | null;
  overduePayments: UpcomingPayment[];
  upcomingPayments: UpcomingPayment[];
}

export interface LivePortfolio {
  data: LivePayload | null;
  /** Total debt with the interest accrued since the last poll added on top. */
  liveTotalDebtTL: number;
  /** Interest accrued since this page loaded, in TL. */
  tickedInterestTL: number;
  isRefreshing: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  refresh: (force?: boolean) => Promise<void>;
}

const POLL_INTERVAL_MS = 60_000;
/** How often the local interest counter advances between polls. */
const TICK_INTERVAL_MS = 1_000;

/**
 * Keeps the dashboard totals live.
 *
 * Two clocks run together:
 *  - a poll every 60s that re-prices gold and re-reads the portfolio, so a
 *    change in the gold rate moves the total debt figure on its own;
 *  - a 1s local tick that advances KMH/card interest using the server's
 *    `dailyAccrualTL`, so the number visibly moves between polls.
 *
 * Polling pauses while the tab is hidden and resumes (with an immediate
 * refresh) when it comes back, so a phone left in a pocket does not burn
 * battery or hammer the API.
 */
export function useLivePortfolio(
  initial: LivePayload | null = null,
  enabled = true
): LivePortfolio {
  const [data, setData] = useState<LivePayload | null>(initial);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(
    initial ? new Date(initial.serverTime) : null
  );
  const [tickedInterestTL, setTickedInterestTL] = useState(0);

  const anchorRef = useRef<number | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (!enabled) return;
    if (inFlight.current && !force) return;
    inFlight.current = true;
    setIsRefreshing(true);

    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Canlı veriler alınamadı");

      setData(payload as LivePayload);
      setLastUpdatedAt(new Date());
      setError(null);
      // Her başarılı çekimde sayaç sıfırlanır; taban artık sunucudan gelen değer.
      anchorRef.current = Date.now();
      setTickedInterestTL(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Canlı veriler alınamadı");
    } finally {
      inFlight.current = false;
      setIsRefreshing(false);
    }
  }, [enabled]);

  // İlk yükleme: sunucudan gelen veri yoksa hemen çek.
  useEffect(() => {
    anchorRef.current = Date.now();
    if (enabled && !initial) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // 60 saniyelik yoklama; sekme gizliyken durur.
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, enabled]);

  // Saniyelik yerel tahakkuk sayacı.
  const dailyAccrual = data?.totals.dailyAccrualTL ?? 0;
  useEffect(() => {
    if (dailyAccrual <= 0) {
      setTickedInterestTL(0);
      return;
    }
    if (anchorRef.current === null) anchorRef.current = Date.now();

    const perSecond = dailyAccrual / 86_400;
    const timer = setInterval(() => {
      const anchor = anchorRef.current ?? Date.now();
      setTickedInterestTL(((Date.now() - anchor) / 1000) * perSecond);
    }, TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [dailyAccrual]);

  return {
    data,
    liveTotalDebtTL: (data?.totals.totalDebtTL ?? 0) + tickedInterestTL,
    tickedInterestTL,
    isRefreshing,
    error,
    lastUpdatedAt,
    refresh,
  };
}
