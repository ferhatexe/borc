"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, ArrowsClockwise, ArrowRight, WarningCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import { triggerHaptic } from "@/lib/haptics";
import type { GoldPriceRecord } from "@/lib/gold/types";

export interface GoldStatus {
  source: string;
  sourceKind: string;
  fetchedAt: string;
  warning: string | null;
  ageMinutes: number;
  pureGramSellTL: number;
  prices: GoldPriceRecord[];
  /** Ürün başına TL marj; kartta ödenecek fiyat bunu içerir. */
  margins?: Record<string, number>;
}

export interface GoldDebtSummary {
  id: string;
  title: string;
  totalTL: number;
  goldType?: string;
  goldName?: string;
  quantity?: number | null;
  grams?: number | null;
  karat?: number | null;
  unitPriceWithPremiumTL?: number;
  isPiece?: boolean;
}

interface GoldLiveRateCardProps {
  goldDebts?: GoldDebtSummary[];
  /** Prices resolved on the server, so the card renders correct on first paint. */
  status: GoldStatus | null;
  error: string | null;
  /** Live re-priced total from the polling hook; falls back to the row sum. */
  liveGoldDebtTL?: number;
}

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  LIVE: { label: "Canlı", className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
  SNAPSHOT: { label: "Kayıtlı veri", className: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  MANUAL: { label: "Manuel", className: "bg-sky-500/10 text-sky-300 border-sky-500/20" },
};

/**
 * Gold rates and the live TL value of the user's gold debts.
 *
 * Values are computed on the server (with the user's margin and millesimal
 * settings) and passed in, so nothing is recalculated with defaults here.
 */
export function GoldLiveRateCard({
  goldDebts = [],
  status,
  error,
  liveGoldDebtTL,
}: GoldLiveRateCardProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/gold", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fiyatlar yenilenemedi");

      triggerHaptic("success");
      toast.success(
        data.sourceKind === "LIVE"
          ? `Fiyatlar güncellendi (${data.source})`
          : `Canlı servise ulaşılamadı, ${data.source} kullanıldı`
      );
      router.refresh();
    } catch (err) {
      triggerHaptic("error");
      toast.error(err instanceof Error ? err.message : "Fiyatlar yenilenemedi");
    } finally {
      setIsRefreshing(false);
    }
  };

  const totalGoldDebtTL =
    liveGoldDebtTL ?? goldDebts.reduce((sum, d) => sum + d.totalTL, 0);
  const prices = status?.prices ?? [];
  const badge = SOURCE_BADGE[status?.sourceKind ?? ""] ?? SOURCE_BADGE.SNAPSHOT;

  const featured = ["GRAM_ALTIN", "CEYREK", "BILEZIK_22", "ZINCIR_21_HALEP"]
    .map((key) => prices.find((p) => p.goldType === key))
    .filter((p): p is GoldPriceRecord => Boolean(p));

  return (
    <section className="p-5 rounded-3xl bg-gradient-to-br from-yellow-950/30 via-zinc-900/90 to-zinc-950 border border-yellow-500/30 shadow-[0_0_35px_rgba(234,179,8,0.12)] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-500/20 text-yellow-400">
            <Coins size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-white">Altın Kurları</h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
            <p className="truncate text-[10px] text-zinc-400">
              {status
                ? `${status.source} · ${formatDate(status.fetchedAt, "dd.MM.yyyy HH:mm")}`
                : "Fiyat kaynağı yok"}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isRefreshing}
          onClick={refresh}
          className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          <ArrowsClockwise
            size={14}
            className={isRefreshing ? "animate-spin text-yellow-400" : ""}
          />
          <span className="hidden sm:inline">Fiyatları Yenile</span>
        </button>
      </div>

      {(error || status?.warning) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
          <WarningCircle size={16} weight="fill" className="shrink-0 mt-0.5" />
          <span>{error ?? status?.warning}</span>
        </div>
      )}

      {goldDebts.length > 0 && (
        <div className="p-4 rounded-2xl bg-black/40 border border-yellow-500/30 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-300">
              Altın borçlarınızın güncel TL karşılığı
            </span>
            <Link
              href="/debts?type=ALTIN_BORCU"
              className="flex items-center gap-1 text-[11px] font-medium text-yellow-400 hover:text-yellow-300"
            >
              <span>Detaylar</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <p className="text-2xl font-bold text-yellow-400 font-mono tabular-nums">
            {formatCurrency(totalGoldDebtTL)}
          </p>

          <ul className="space-y-1 pt-1">
            {goldDebts.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-500/15 bg-yellow-500/5 px-2.5 py-1.5 text-[11px]"
              >
                <span className="text-zinc-200">
                  {d.title}
                  <span className="ml-1.5 text-zinc-500">
                    {d.isPiece
                      ? `${formatNumber(d.quantity ?? 0, 2)} adet`
                      : `${formatNumber(d.grams ?? 0, 2)} gr${d.karat ? ` · ${d.karat} ayar` : ""}`}
                  </span>
                </span>
                <span className="font-mono font-semibold text-yellow-300 tabular-nums">
                  {formatCurrency(d.totalTL)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {prices.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {featured.map((p) => {
            // Kartta ödenecek fiyat gösterilir: piyasa + marj.
            const margin = status?.margins?.[p.goldType] ?? 0;
            return (
            <div
              key={p.goldType}
              className="p-3 rounded-2xl bg-zinc-900/70 border border-white/5 space-y-0.5"
            >
              <span className="block text-[10px] text-zinc-400">
                {p.name}
                {margin > 0 && (
                  <span className="ml-1 rounded bg-amber-500/20 px-1 text-[8.5px] font-bold text-amber-300">
                    +{formatNumber(margin, 0)}
                  </span>
                )}
              </span>
              <p className="text-sm font-bold text-white font-mono tabular-nums">
                {formatCurrency(p.sellPrice + margin)}
              </p>
              <span className="block text-[9px] text-zinc-500">
                {margin > 0
                  ? `${formatNumber(p.sellPrice, 2)} + ${formatNumber(margin, 0)} marj`
                  : p.isPiece
                    ? "adet satış"
                    : "gram satış"}
                {p.karat ? ` · ${p.karat} ayar` : ""}
              </span>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
          <Coins size={28} className="mx-auto mb-2 text-zinc-600" />
          <p className="text-xs text-zinc-400">Gösterilecek altın fiyatı yok.</p>
          <Link
            href="/settings"
            className="mt-2 inline-block text-[11px] text-yellow-400 underline hover:text-yellow-300"
          >
            Ayarlardan manuel fiyat gir
          </Link>
        </div>
      )}
    </section>
  );
}
