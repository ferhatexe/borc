"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChartPieSlice, ShoppingBag } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/formatters";

interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  amountTL: number;
  percentage: number;
  color: string;
}

interface ExpenseCategoryDonutProps {
  categories: CategoryBreakdownItem[];
  totalExpenseTL: number;
}

export function ExpenseCategoryDonut({
  categories,
  totalExpenseTL,
}: ExpenseCategoryDonutProps) {
  if (!categories || categories.length === 0 || totalExpenseTL === 0) {
    return (
      <div className="glass-card p-6 flex flex-col justify-center items-center text-center space-y-3 min-h-[320px]">
        <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
          <ChartPieSlice size={24} weight="duotone" />
        </div>
        <h4 className="text-sm font-semibold text-zinc-300">Harcama Dağılımı</h4>
        <p className="text-xs text-zinc-500 max-w-xs">
          Bu ay henüz kategorize edilmiş harcama bulunmuyor.
        </p>
      </div>
    );
  }

  // İlk 5 kategori + Diğerleri
  const topCategories = categories.slice(0, 5);
  const otherCategories = categories.slice(5);
  const otherSum = otherCategories.reduce((sum, c) => sum + c.amountTL, 0);

  const chartData = [...topCategories];
  if (otherSum > 0) {
    chartData.push({
      categoryId: "others",
      categoryName: "Diğer Harcamalar",
      amountTL: otherSum,
      percentage: Number(((otherSum / totalExpenseTL) * 100).toFixed(1)),
      color: "#71717a",
    });
  }

  return (
    <div className="glass-card p-6 border-white/10 space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ChartPieSlice size={20} weight="duotone" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Aylık Harcama Dağılımı</h3>
            <p className="text-xs text-zinc-400">Bu ayki giderlerin kategorilere göre kırılımı</p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold text-rose-400">
          {formatCurrency(totalExpenseTL)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
        {/* Donut Grafik */}
        <div className="h-52 w-full relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  borderColor: "#3f3f46",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                }}
                formatter={(val: any) => [formatCurrency(val), "Tutar"]}
              />
              <Pie
                data={chartData}
                dataKey="amountTL"
                nameKey="categoryName"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="#18181b"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Donut Merkez Metrik */}
          <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Toplam</span>
            <span className="text-sm font-bold text-white font-mono">
              {formatCurrency(totalExpenseTL)}
            </span>
          </div>
        </div>

        {/* Kategori Açıklamaları Listesi */}
        <div className="space-y-2">
          {chartData.map((cat) => (
            <div
              key={cat.categoryId}
              className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-zinc-300 truncate">{cat.categoryName}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono text-right">
                <span className="text-white font-medium">{formatCurrency(cat.amountTL)}</span>
                <span className="text-zinc-500 text-[10px] w-10 text-right">
                  %{cat.percentage}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
