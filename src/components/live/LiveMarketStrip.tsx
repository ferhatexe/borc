"use client";

import { ArrowsClockwise, CaretDown, CaretUp, WarningCircle } from "@phosphor-icons/react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import type { LiveMarket } from "@/lib/hooks/useLivePortfolio";

interface LiveMarketStripProps {
  market: LiveMarket | null;
  error: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  lastUpdatedAt: Date | null;
}

function Change({ value }: { value: number | null }) {
  if (value === null || value === 0) return null;
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${
        up ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      {up ? <CaretUp size={9} weight="fill" /> : <CaretDown size={9} weight="fill" />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function Chip({
  label,
  value,
  sub,
  change,
  accent,
  hasMargin,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: number | null;
  accent?: "gold" | "usd" | "neutral";
  /** Marj dahil edilmiş fiyatları görsel olarak ayırır. */
  hasMargin?: boolean;
}) {
  const ring =
    accent === "gold"
      ? "border-amber-500/25 bg-amber-500/[0.07]"
      : accent === "usd"
        ? "border-emerald-500/20 bg-emerald-500/[0.06]"
        : "border-white/8 bg-white/[0.03]";

  return (
    <div
      className={`flex min-w-[7.5rem] shrink-0 snap-start flex-col justify-between rounded-xl border px-3 py-2 ${ring}`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
          {label}
        </span>
        {hasMargin ? (
          <span className="rounded bg-amber-500/20 px-1 text-[8.5px] font-bold text-amber-300">
            MARJLI
          </span>
        ) : (
          <Change value={change ?? null} />
        )}
      </div>
      <span className="mt-0.5 font-mono text-sm font-bold tabular-nums text-zinc-50">{value}</span>
      {sub && <span className="text-[9px] text-zinc-500">{sub}</span>}
    </div>
  );
}

/**
 * Live gold and currency rates.
 *
 * On mobile it is a horizontally snap-scrolling chip row (one thumb swipe);
 * on desktop the same chips wrap into a grid. Values refresh on the same 60s
 * poll that drives the totals.
 */
export function LiveMarketStrip({
  market,
  error,
  isRefreshing,
  onRefresh,
  lastUpdatedAt,
}: LiveMarketStripProps) {
  const usd = market?.currencies.find((c) => c.code === "USD");
  const eur = market?.currencies.find((c) => c.code === "EUR");
  const others = market?.currencies.filter((c) => !["USD", "EUR"].includes(c.code)) ?? [];

  const ceyrek = market?.prices.find((p) => p.goldType === "CEYREK");
  const bilezik22 = market?.prices.find((p) => p.goldType === "BILEZIK_22");
  const halep21 = market?.prices.find((p) => p.goldType === "ZINCIR_21_HALEP");

  /**
   * Chip'ler ödenecek gerçek fiyatı gösterir: piyasa fiyatı + kullanıcının marjı.
   * Ham piyasa fiyatı alt satırda kalır, çünkü borç hesabına giren rakam
   * marj dahil olandır ve ikisini karıştırmak "200 nerede?" sorusuna yol açıyor.
   */
  const marginOf = (goldType: string) => market?.margins?.[goldType] ?? 0;

  return (
    <section
      aria-label="Canlı piyasa"
      className="rounded-2xl border border-white/8 bg-zinc-950/60 p-3 backdrop-blur-xl"
    >
      <header className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <h2 className="truncate text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
            Canlı Piyasa
          </h2>
          {market && (
            <span className="hidden truncate text-[10px] text-zinc-500 sm:inline">
              {market.source}
              {lastUpdatedAt &&
                ` · ${lastUpdatedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Kurları yenile"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white active:scale-95 disabled:opacity-50"
        >
          <ArrowsClockwise
            size={16}
            className={isRefreshing ? "animate-spin text-emerald-400" : ""}
          />
        </button>
      </header>

      {(error || market?.warning) && (
        <p className="mb-2 flex items-start gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-200">
          <WarningCircle size={13} weight="fill" className="mt-px shrink-0" />
          <span>{error ?? market?.warning}</span>
        </p>
      )}

      {market ? (
        <div
          className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible"
          role="list"
        >
          <Chip
            label="Gram Has"
            value={formatCurrency(market.pureGramSellTL)}
            sub="satış"
            change={market.pureGramChangePercent}
            accent="gold"
          />

          {market.ounce && (
            <Chip
              label="ONS Altın"
              value={`$${formatNumber(market.ounce.usd, 2)}`}
              sub={market.ounce.basis === "QUOTED" ? "canlı XAU/USD" : "hesaplanan"}
              accent="gold"
            />
          )}

          {usd && (
            <Chip
              label="USD/TRY"
              value={formatNumber(usd.sellPrice, 4)}
              sub="satış"
              change={usd.changePercent}
              accent="usd"
            />
          )}

          {eur && (
            <Chip
              label="EUR/TRY"
              value={formatNumber(eur.sellPrice, 4)}
              sub="satış"
              change={eur.changePercent}
              accent="usd"
            />
          )}

          {[
            { rec: ceyrek, label: "Çeyrek", unit: "adet" },
            { rec: bilezik22, label: "22 Ayar", unit: "gram" },
            { rec: halep21, label: "21 Ayar", unit: "gram" },
          ].map(({ rec, label, unit }) => {
            if (!rec) return null;
            const margin = marginOf(rec.goldType);
            const withMargin = rec.sellPrice + margin;

            return (
              <Chip
                key={rec.goldType}
                label={label}
                value={formatCurrency(withMargin)}
                sub={
                  margin > 0
                    ? `${formatNumber(rec.sellPrice, 2)} + ${formatNumber(margin, 0)} marj`
                    : `${unit} satış`
                }
                accent="gold"
                hasMargin={margin > 0}
              />
            );
          })}

          {others.map((c) => (
            <Chip
              key={c.code}
              label={`${c.code}/TRY`}
              value={formatNumber(c.sellPrice, 4)}
              sub="satış"
              change={c.changePercent}
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[3.25rem] min-w-[7.5rem] flex-1 animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none"
            />
          ))}
        </div>
      )}

      <div className="mt-1.5 space-y-0.5 px-0.5 text-[9px] leading-tight text-zinc-600">
        {market?.ounce?.basis === "DERIVED" && (
          <p>
            <span className="font-semibold text-amber-500/80">HESAPLANAN</span> ONS:
            canlı XAU/USD kotasyonuna ulaşılamadı, değer gram has altın ve USD/TRY
            kurundan türetildi (gram × 31,1035 ÷ USD). Gerçek kotasyondan yaklaşık
            %0,6 sapabilir.
          </p>
        )}
        {market && Object.values(market.margins ?? {}).some((m) => m > 0) && (
          <p>
            <span className="font-semibold text-amber-500/80">MARJLI</span> etiketli
            fiyatlara Ayarlar&apos;daki marjınız eklenmiştir; borç hesabına giren
            rakam budur.
          </p>
        )}
      </div>
    </section>
  );
}
