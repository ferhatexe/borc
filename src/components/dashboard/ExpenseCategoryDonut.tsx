"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChartPieSlice, TrendUp, TrendDown, Sparkle } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/formatters";
import { useChartTheme } from "@/lib/hooks/useChartTheme";

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
  const chart = useChartTheme();
  const ayAdı = AY_ADLARI[new Date().getMonth()];

  if (!categories || categories.length === 0 || totalExpenseTL === 0) {
    return (
      <div className="glass-card flex min-h-[320px] flex-col items-center justify-center space-y-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-500">
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

  return (
    <div className="glass-card space-y-4 border-white/10 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
            <ChartPieSlice size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">Harcama Dağılımı</h3>
            <p className="text-xs text-zinc-400">
              {ayAdı} ayı · {categories.length} kategori
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-bold text-rose-400">
            {formatCurrency(totalExpenseTL)}
          </p>
          {previousTotalTL !== undefined && previousTotalTL > 0 && (
            <div className="mt-0.5 flex justify-end">
              <ChangeBadge
                changePercent={totalChangePercent}
                previousAmountTL={previousTotalTL}
              />
            </div>
          )}
        </div>
      </div>

      {/* Halka: dar sütunda da bozulmasın diye liste her zaman altında durur. */}
      <div className="relative mx-auto flex h-44 w-full max-w-[15rem] items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={chart.tooltipStyle}
                labelStyle={chart.tooltipLabelStyle}
              formatter={(val: number | string) => [formatCurrency(Number(val)), "Tutar"]}
            />
            <Pie
              data={chartData}
              dataKey="amountTL"
              nameKey="categoryName"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={tekKategori ? 0 : 3}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.categoryId}
                  fill={entry.color}
                  stroke={chart.sliceStroke}
                  strokeWidth={2}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Toplam</span>
          <span className="font-mono text-sm font-bold text-white">
            {formatCurrency(totalExpenseTL)}
          </span>
          {previousTotalTL !== undefined && previousTotalTL > 0 && (
            <span className="mt-0.5 font-mono text-[9px] text-zinc-500">
              geçen ay {formatCurrency(previousTotalTL)}
            </span>
          )}
        </div>
      </div>

      {/* Kategori listesi: ad kendi satırında, rakamlar altında - kısaltma yok. */}
      <ul className="space-y-2.5">
        {chartData.map((cat) => (
          <li key={cat.categoryId} className="space-y-1">
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
                %{cat.percentage}
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
            harcamanızın %{enBüyük.percentage}&apos;i ({formatCurrency(enBüyük.amountTL)}).
          </>
        )}
      </p>
    </div>
  );
}
