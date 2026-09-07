"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Sparkle, Lightning, PiggyBank, CalendarCheck } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/formatters";
import { triggerHaptic } from "@/lib/haptics";
import {
  calculateScenarioProjection,
  LoanProjectionInput,
} from "@/lib/finance/scenarioProjection";
import { useChartTheme } from "@/lib/hooks/useChartTheme";

interface ScenarioSimulatorCardProps {
  /**
   * Already-valued loans from the server. The card no longer guesses missing
   * figures (it used to fall back to 50.000 TL principal / %3,5 interest /
   * 5.000 TL instalment, which produced a simulation of numbers the user had
   * never entered).
   */
  loans: Array<LoanProjectionInput & { remainingMonths?: number }>;
}

export function ScenarioSimulatorCard({ loans }: ScenarioSimulatorCardProps) {
  const chart = useChartTheme();
  const [monthlyExtra, setMonthlyExtra] = useState<number>(2000);
  const [lumpSum, setLumpSum] = useState<number>(0);
  const [lumpSumMonth, setLumpSumMonth] = useState<number>(3);

  // Only loans that carry every figure the simulation needs.
  const loanInputs: LoanProjectionInput[] = useMemo(
    () =>
      loans.filter(
        (l) => Number(l.remainingPrincipal) > 0 && Number(l.monthlyPayment) > 0
      ),
    [loans]
  );

  // Simülasyonu çalıştır
  const simulation = useMemo(() => {
    if (loanInputs.length === 0) return null;
    return calculateScenarioProjection({
      loans: loanInputs,
      monthlyExtraPayment: monthlyExtra,
      lumpSumAmount: lumpSum,
      lumpSumMonthIndex: lumpSumMonth,
    });
  }, [loanInputs, monthlyExtra, lumpSum, lumpSumMonth]);

  /*
   * Eskiden burada sessizce `null` donuluyordu. Rapor sayfasi bilesene yanlis
   * bicimde veri verdiginde (ham borc kaydi, degerleme yerine) sekme bombos
   * aciliyor ve hicbir sey neden gorunmedigini soylemiyordu. Bos durum artik
   * gorunur ve sebebini yaziyor.
   */
  if (loanInputs.length === 0) {
    return (
      <div className="glass-card space-y-3 p-8 text-center">
        <Sparkle size={32} className="mx-auto text-emerald-500/50" />
        <h4 className="text-sm font-bold text-white">Simülasyon için uygun kredi yok</h4>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-zinc-400">
          {loans.length === 0
            ? "Erken kapama ve ek ödeme simülasyonu için en az bir taksitli kredi kaydı gerekiyor."
            : `${loans.length} kredi bulundu ama hiçbirinde simülasyon için gereken kalan anapara, taksit tutarı ve faiz oranı birlikte yok.`}
        </p>
      </div>
    );
  }

  if (!simulation) return null;

  const handleExtraClick = (val: number) => {
    triggerHaptic("selection");
    setMonthlyExtra(val);
  };

  const handleLumpSumClick = (val: number) => {
    triggerHaptic("selection");
    setLumpSum(val);
  };

  return (
    <div className="glass-card p-6 border-emerald-500/20 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30">
            <Sparkle size={22} weight="fill" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                Borç Erken Bitirme & Tasarruf Simülatörü
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                Çığ / Avalanche Metodu
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Aylık bütçenize ek ödeme veya toplu para ekleyerek borcun ne kadar erken biteceğini görün
            </p>
          </div>
        </div>
      </div>

      {/* Kontrol Paneli: Ek Ödeme & Toplu Para */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Aylık Düzenli Ek Ödeme */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">Aylık Ekstra Ödeme:</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              +{formatCurrency(monthlyExtra)} / ay
            </span>
          </div>

          {/* Hızlı Butonlar */}
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 1000, 2500, 5000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleExtraClick(amt)}
                className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  monthlyExtra === amt
                    ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20"
                    : "bg-white/5 hover:bg-white/10 text-zinc-300"
                }`}
              >
                {amt === 0 ? "0 ₺" : `+${amt / 1000}k ₺`}
              </button>
            ))}
          </div>

          <input
            type="range"
            min="0"
            max="20000"
            step="500"
            value={monthlyExtra}
            onChange={(e) => setMonthlyExtra(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* 2. Tek Seferlik Toplu Para Girişi */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">Toplu Ödeme (İkramiye/Satış):</span>
            <span className="text-sm font-bold text-teal-400 font-mono">
              {lumpSum > 0 ? formatCurrency(lumpSum) : "Yok"}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[0, 25000, 50000, 100000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleLumpSumClick(amt)}
                className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  lumpSum === amt
                    ? "bg-teal-500 text-zinc-950 font-bold shadow-md shadow-teal-500/20"
                    : "bg-white/5 hover:bg-white/10 text-zinc-300"
                }`}
              >
                {amt === 0 ? "0 ₺" : `${amt / 1000}k ₺`}
              </button>
            ))}
          </div>

          {lumpSum > 0 && (
            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <span>Hangi Ayda Uygulansın?</span>
              <select
                value={lumpSumMonth}
                onChange={(e) => setLumpSumMonth(Number(e.target.value))}
                className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
              >
                {[1, 2, 3, 6, 12].map((m) => (
                  <option key={m} value={m}>
                    {m}. Ayda
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Karşılaştırmalı Sonuç Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Kazanılan Zaman */}
        <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <CalendarCheck size={16} />
            <span>Erken Kapanma Kazancı</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {simulation.monthsSaved > 0 ? `${simulation.monthsSaved} Ay Erken` : "Normal Vade"}
          </p>
          <p className="text-[11px] text-zinc-400">
            {simulation.baseMonthsToDebtFree} ay yerine{" "}
            <strong className="text-emerald-300">{simulation.acceleratedMonthsToDebtFree} ayda</strong> borçsuz
          </p>
        </div>

        {/* Toplam Faiz Tasarrufu */}
        <div className="p-4 rounded-2xl bg-teal-950/30 border border-teal-500/30 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-teal-400 font-medium">
            <PiggyBank size={16} />
            <span>Toplam Faiz Tasarrufu</span>
          </div>
          <p className="text-2xl font-bold text-teal-300 font-mono">
            {formatCurrency(simulation.totalInterestSaved)}
          </p>
          <p className="text-[11px] text-zinc-400">Ödenmeyecek faiz ve vergiler</p>
        </div>

        {/* Ödenecek Kümülatif Faiz */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
            <Lightning size={16} />
            <span>Toplam Faiz Yükü (Yeni)</span>
          </div>
          <p className="text-2xl font-bold text-zinc-200 font-mono">
            {formatCurrency(simulation.acceleratedTotalInterestPaid)}
          </p>
          <p className="text-[11px] text-zinc-500 line-through">
            Normalde: {formatCurrency(simulation.baseTotalInterestPaid)}
          </p>
        </div>
      </div>

      {/* Karşılaştırmalı 2 Eğrili Grafik */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={simulation.trajectory}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#71717a" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#71717a" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorAccel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
            <XAxis dataKey="monthLabel" stroke={chart.axis} fontSize={10} tickLine={false} />
            <YAxis
              stroke={chart.axis}
              fontSize={10}
              tickLine={false}
              tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={chart.tooltipStyle}
                labelStyle={chart.tooltipLabelStyle}
              formatter={(val: any, name: any) => [
                formatCurrency(val),
                name === "baseRemainingPrincipal" ? "Normal Plan Kalan" : "Hızlandırılmış Kalan",
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) =>
                value === "baseRemainingPrincipal"
                  ? "Standart Taksit Planı"
                  : "Hızlandırılmış Erken Ödeme"
              }
            />
            <Area
              type="monotone"
              dataKey="baseRemainingPrincipal"
              name="baseRemainingPrincipal"
              stroke={chart.axis}
              strokeDasharray="4 4"
              fillOpacity={1}
              fill="url(#colorBase)"
            />
            <Area
              type="monotone"
              dataKey="acceleratedRemainingPrincipal"
              name="acceleratedRemainingPrincipal"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorAccel)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
