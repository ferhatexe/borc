"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ChartLineUp, CalendarBlank, Info } from "@phosphor-icons/react";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface TrajectoryPoint {
  monthIndex: number;
  monthName: string;
  remainingDebtTL: number;
  monthlyPaymentTL: number;
  /** Portion that actually amortises on a schedule. */
  scheduledRemainingTL?: number;
  /** Revolving balances (KMH, kart) carried flat - no invented decay. */
  revolvingRemainingTL?: number;
}

interface DebtTrajectoryChartProps {
  data: TrajectoryPoint[];
  projectedDebtFreeDate?: string | null;
}

export function DebtTrajectoryChart({ data, projectedDebtFreeDate }: DebtTrajectoryChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const hasRevolving = data.some((d) => (d.revolvingRemainingTL ?? 0) > 0);

  const initialDebt = data[0]?.remainingDebtTL || 0;
  const finalDebt = data[data.length - 1]?.remainingDebtTL || 0;
  const dissolvedDebt = Math.max(0, initialDebt - finalDebt);

  return (
    <div className="glass-card p-6 border-white/10 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ChartLineUp size={20} weight="duotone" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">12 Aylık Borç Erime Projeksiyonu</h3>
            <p className="text-xs text-zinc-400">
              Mevcut taksit planınıza göre gelecek 12 ayın tahmini anapara seyri
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 block uppercase">12 Ayda Eriyip Bitecek</span>
            <span className="text-emerald-400 font-bold">{formatCurrency(dissolvedDebt)}</span>
          </div>
        </div>
      </div>

      {/* Recharts Area Grafiği */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTrajectory" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,113,122,0.28)" vertical={false} />
            <XAxis
              dataKey="monthName"
              stroke="#71717a"
              fontSize={10}
              tickLine={false}
              tickFormatter={(str) => str.split(" ")[0]}
            />
            <YAxis
              stroke="#71717a"
              fontSize={10}
              tickLine={false}
              tickFormatter={(val) => `${(val / 1000).toFixed(0)}k ₺`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                borderColor: "#3f3f46",
                borderRadius: "0.75rem",
                fontSize: "12px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              }}
              formatter={(value: any) => [formatCurrency(value), "Kalan Borç"]}
              labelFormatter={(label) => `Vade: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="remainingDebtTL"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorTrajectory)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <CalendarBlank size={14} className="text-emerald-400" />
            <span>
              {projectedDebtFreeDate
                ? `Tahmini borçsuz kalma tarihi: ${formatDate(projectedDebtFreeDate)}`
                : "Mevcut plana göre borç 12 ay içinde kapanmıyor."}
            </span>
          </span>
          <span className="text-zinc-400">12 aylık görünüm</span>
        </div>

        {hasRevolving && (
          <p className="flex items-start gap-1.5 text-[10px] text-zinc-500">
            <Info size={13} className="mt-0.5 shrink-0 text-amber-400" />
            <span>
              Kredi kartı ve KMH gibi dönen bakiyeler, bir ödeme planı tanımlı olmadığı için
              sabit kabul edilir; yalnızca taksit planı olan krediler erir.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
