"use client";

import { useState } from "react";
import { ChartPieSlice, TrendUp, TrendDown, Sparkle } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/formatters";

const R = 62;
const CIRC = 2 * Math.PI * R;
const pct = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  amountTL: number;
  percentage: number;
  color: string;
  previousAmountTL?: number;
  changePercent?: number | null;
}

interface ExpenseCategoryDonutProps {
  categories: CategoryBreakdownItem[];
  totalExpenseTL: number;
  /** Geçen ayın toplam gideri; başlıktaki karşılaştırma için. */
  previousTotalTL?: number;
  totalChangePercent?: number | null;
}

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/**
 * Geçen aya göre değişim rozeti.
 *
 * Giderde artış kötüdür, o yüzden renkler gelir grafiğinin tersidir: yukarı ok
 * kırmızı, aşağı ok yeşil. Geçen ay o kategoride harcama yoksa yüzde yerine
 * "yeni" yazar - sıfırdan artışın yüzdesi yoktur.
 */
function ChangeBadge({
  changePercent,
  previousAmountTL,
}: {
  changePercent?: number | null;
  previousAmountTL?: number;
}) {
  if (changePercent === null || changePercent === undefined) {
    if (previousAmountTL === 0) {
      return (
        <span className="inline-flex items-center gap-0.5 rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-400">
          <Sparkle size={9} weight="fill" /> yeni
        </span>
      );
    }
    return null;
  }

  if (Math.abs(changePercent) < 0.05) {
    return (
      <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500">
        aynı
      </span>
    );
  }

  const arttı = changePercent > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-semibold tabular-nums ${
        arttı ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
      }`}
      title={`Geçen ay: ${formatCurrency(previousAmountTL ?? 0)}`}
    >
      {arttı ? <TrendUp size={9} weight="bold" /> : <TrendDown size={9} weight="bold" />}
      %{Math.abs(changePercent).toFixed(1)}
    </span>
  );
}

export function ExpenseCategoryDonut({
  categories,
  totalExpenseTL,
  previousTotalTL,
  totalChangePercent,
}: ExpenseCategoryDonutProps) {
  const [active, setActive] = useState<number | null>(null);
  const ayAdı = AY_ADLARI[new Date().getMonth()];

  if (!categories || categories.length === 0 || totalExpenseTL === 0) {
    return (
      <div className="glass-card flex min-h-[180px] flex-col items-center justify-center space-y-2.5 p-5 text-center sm:min-h-[320px] sm:p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-500 shrink-0">
          <ChartPieSlice size={24} weight="duotone" />
        </div>
        <h4 className="text-sm font-semibold text-zinc-300">Harcama Dağılımı</h4>
        <p className="max-w-xs text-xs text-zinc-500">
          {ayAdı} ayında henüz kategorize edilmiş harcama bulunmuyor.
          {previousTotalTL ? ` Geçen ay ${formatCurrency(previousTotalTL)} harcamıştınız.` : ""}
        </p>
      </div>
    );
  }

  // İlk 6 kategori ayrı, kalanı tek dilimde toplanır.
  const topCategories = categories.slice(0, 6);
  const otherCategories = categories.slice(6);
  const otherSum = otherCategories.reduce((sum, c) => sum + c.amountTL, 0);
  const otherPrevSum = otherCategories.reduce((sum, c) => sum + (c.previousAmountTL ?? 0), 0);

  const chartData: CategoryBreakdownItem[] = [...topCategories];
  if (otherSum > 0) {
    chartData.push({
      categoryId: "others",
      categoryName: `Diğer ${otherCategories.length} kategori`,
      amountTL: otherSum,
      percentage: Number(((otherSum / totalExpenseTL) * 100).toFixed(1)),
      color: "#71717a",
      previousAmountTL: otherPrevSum,
      changePercent:
        otherPrevSum > 0
          ? Number((((otherSum - otherPrevSum) / otherPrevSum) * 100).toFixed(1))
          : null,
    });
  }

  const enBüyük = chartData[0];
  // Tek kategori varsa halka %100 dolu olur; pay çubuğu ve kıyas satırı
  // grafiğin tek başına söyleyemediğini söyler.
  const tekKategori = chartData.length === 1;

  // Dilimler: çevre üzerinde başlangıç ve uzunluk; aralarında 2 birim boşluk.
  const gap = tekKategori ? 0 : 2;
  let cursor = 0;
  const arcs = chartData.map((cat) => {
    const full = (cat.amountTL / totalExpenseTL) * CIRC;
    const arc = { cat, start: cursor + gap / 2, len: Math.max(0.5, full - gap) };
    cursor += full;
    return arc;
  });
  const shown = active !== null ? chartData[active] : null;

  return (
    <div className="glass-card space-y-4 border-white/10 p-5 sm:p-6">
      <div className="space-y-2 border-b border-white/10 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
            <ChartPieSlice size={18} weight="duotone" />
          </div>
          <h3 className="truncate text-base font-bold text-white">Harcama Dağılımı</h3>
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="min-w-0 text-[11px] leading-snug text-zinc-400">
            {ayAdı} · {categories.length} kategori
            {previousTotalTL !== undefined && previousTotalTL > 0 && (
              <span className="block text-zinc-500">geçen ay {formatCurrency(previousTotalTL)}</span>
            )}
          </p>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold tabular-nums text-rose-400">{formatCurrency(totalExpenseTL)}</p>
            {previousTotalTL !== undefined && previousTotalTL > 0 && (
              <div className="mt-0.5 flex justify-end">
                <ChangeBadge changePercent={totalChangePercent} previousAmountTL={previousTotalTL} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/*
        Halka elle çizilir (SVG): kütüphanenin üstüne gelince çıkan kutucuğu
        telefonda yazıyı bozuyordu. Dilime ya da listedeki satıra dokununca
        ortada o kategori yazar; boşta toplam.
      */}
      <div className="relative mx-auto h-40 w-40">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label="Harcama dağılımı">
          <circle cx="80" cy="80" r={R} fill="none" strokeWidth={20} className="stroke-zinc-800" />
          {arcs.map((a, i) => (
            <circle
              key={a.cat.categoryId}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={a.cat.color}
              strokeWidth={active === i ? 26 : 20}
              strokeDasharray={`${a.len} ${CIRC - a.len}`}
              strokeDashoffset={-a.start}
              opacity={active === null || active === i ? 1 : 0.3}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(active === i ? null : i)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          {shown ? (
            <>
              <span className="w-full truncate text-[10px] font-medium leading-tight text-zinc-400">
                {shown.categoryName}
              </span>
              <span className="text-lg font-bold leading-tight tabular-nums" style={{ color: shown.color }}>
                %{pct(shown.percentage)}
              </span>
              <span className="text-[11px] font-semibold leading-tight tabular-nums text-white">
                {formatCurrency(shown.amountTL)}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Toplam</span>
              <span className="text-sm font-bold leading-tight tabular-nums text-white">
                {formatCurrency(totalExpenseTL)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Kategori listesi: ad kendi satırında, rakamlar altında - kısaltma yok. */}
      <ul className="space-y-2.5">
        {chartData.map((cat, i) => (
          <li
            key={cat.categoryId}
            className={`cursor-pointer space-y-1 rounded-lg transition-opacity ${
              active === null || active === i ? "" : "opacity-50"
            }`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive(active === i ? null : i)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="truncate text-xs font-medium text-zinc-200">
                  {cat.categoryName}
                </span>
              </div>
              <span className="shrink-0 font-mono text-xs font-semibold text-white">
                {formatCurrency(cat.amountTL)}
              </span>
            </div>

            <div className="flex items-center gap-2 pl-[1.125rem]">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5"
                role="presentation"
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                />
              </div>
              <span className="w-11 shrink-0 text-right font-mono text-[10px] tabular-nums text-zinc-500">
                %{pct(cat.percentage)}
              </span>
              <ChangeBadge
                changePercent={cat.changePercent}
                previousAmountTL={cat.previousAmountTL}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-zinc-400">
        {tekKategori ? (
          <>
            Bu ayki tüm harcamanız{" "}
            <span className="font-semibold text-zinc-200">{enBüyük.categoryName}</span>{" "}
            kategorisinde. Gider eklerken kategori seçerseniz dağılım anlamlanır.
          </>
        ) : (
          <>
            En büyük kalem{" "}
            <span className="font-semibold text-zinc-200">{enBüyük.categoryName}</span>:
            harcamanızın %{pct(enBüyük.percentage)}&apos;i ({formatCurrency(enBüyük.amountTL)}).
          </>
        )}
      </p>
    </div>
  );
}
