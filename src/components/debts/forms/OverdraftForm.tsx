"use client";

import { useState, useEffect, useMemo } from "react";
import { calculateOverdraftInterest } from "@/lib/finance/overdraft";
import { formatCurrency, toDateInputValue } from "@/lib/formatters";
import { useAppSettings } from "@/lib/hooks/useAppSettings";
import { Vault, Lightning, CalendarBlank } from "@phosphor-icons/react";

export interface OverdraftFormData {
  title: string;
  limit: number;
  usedAmount: number;
  interestRateMonthly: number;
  /** Interest accrues from this date; the live counter is anchored to it. */
  lastInterestChargeDate: string;
  accrualBasis: "GUNLUK";
  notes?: string;
}

interface OverdraftFormProps {
  initialData?: Partial<OverdraftFormData>;
  institutionName?: string;
  onChange: (data: OverdraftFormData, isValid: boolean) => void;
}

export function OverdraftForm({ initialData, institutionName, onChange }: OverdraftFormProps) {
  const { settings } = useAppSettings();
  const kkdfRate = settings.taxRates.kkdfRate;
  const bsmvRate = settings.taxRates.bsmvRate;

  const [title, setTitle] = useState(
    initialData?.title || `${institutionName || "Banka"} KMH / Ek Hesap`
  );
  const [limit, setLimit] = useState<number>(initialData?.limit ?? 0);
  const [usedAmount, setUsedAmount] = useState<number>(initialData?.usedAmount ?? 0);
  const [interestRateMonthly, setInterestRateMonthly] = useState<number>(
    initialData?.interestRateMonthly ?? 0
  );
  // Faizin hangi tarihten beri isledigi; canli sayac bunu esas alir.
  const [lastInterestChargeDate, setLastInterestChargeDate] = useState<string>(
    initialData?.lastInterestChargeDate ?? toDateInputValue()
  );
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Anlık günlük ve aylık faiz simülasyonu
  const accrual = useMemo(() => {
    if (usedAmount <= 0) return null;
    const daily = calculateOverdraftInterest({
      usedAmount,
      monthlyInterestRatePercent: interestRateMonthly,
      days: 1,
      includeKKDF: true,
      kkdfRate,
      includeBSMV: true,
      bsmvRate,
    });

    const monthly30 = calculateOverdraftInterest({
      usedAmount,
      monthlyInterestRatePercent: interestRateMonthly,
      days: 30,
      includeKKDF: true,
      kkdfRate,
      includeBSMV: true,
      bsmvRate,
    });

    return {
      dailyCost: daily.totalAccruedInterest.toNumber(),
      dailyRawInterest: daily.interestAmount.toNumber(),
      dailyTax: daily.kkdfAmount.plus(daily.bsmvAmount).toNumber(),
      monthlyCost: monthly30.totalAccruedInterest.toNumber(),
      monthlyTotalPayoff: monthly30.totalPayoffAmount.toNumber(),
    };
  }, [usedAmount, interestRateMonthly, kkdfRate, bsmvRate]);

  useEffect(() => {
    const isValid =
      title.trim().length > 0 &&
      limit > 0 &&
      usedAmount >= 0 &&
      usedAmount <= limit &&
      interestRateMonthly > 0 &&
      Boolean(lastInterestChargeDate);

    onChange(
      {
        title,
        limit,
        usedAmount,
        interestRateMonthly,
        lastInterestChargeDate,
        accrualBasis: "GUNLUK",
        notes,
      },
      isValid
    );
  }, [title, limit, usedAmount, interestRateMonthly, lastInterestChargeDate, notes]);

  const usageRatio = limit > 0 ? (usedAmount / limit) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">Hesap Başlığı *</label>
        <div className="relative">
          <Vault size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: QNB Artı Para / Ek Hesap"
            className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Limit & Kullanılan Eksi Bakiye */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            KMH / Ek Hesap Limiti *
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="500"
              required
              value={limit || ""}
              onChange={(e) => setLimit(Number(e.target.value))}
              placeholder="20.000"
              className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono text-base"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
              ₺
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Kullanılan Bakiye (Eksi Tutar) *
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="100"
              required
              value={usedAmount || ""}
              onChange={(e) => setUsedAmount(Number(e.target.value))}
              placeholder="12.500"
              className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono text-base"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
              ₺
            </span>
          </div>
        </div>
      </div>

      {/* Faiz Oranı */}
      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
          Aylık KMH Akdi Faiz Oranı (%) *
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={interestRateMonthly || ""}
            onChange={(e) => setInterestRateMonthly(Number(e.target.value))}
            placeholder="5.00"
            className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono text-base"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
            %
          </span>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1">
          Faizin üzerine %{Math.round(kkdfRate * 100)} KKDF ve %{Math.round(bsmvRate * 100)} BSMV
          gün bazında eklenir. Oranları Ayarlar&apos;dan değiştirebilirsiniz.
        </p>
      </div>

      {/* Son faiz tahakkuk tarihi - canlı sayacın başlangıç noktası */}
      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
          Son Faiz Tahakkuk Tarihi *
        </label>
        <div className="relative">
          <CalendarBlank
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="date"
            required
            max={toDateInputValue()}
            value={lastInterestChargeDate}
            onChange={(e) => setLastInterestChargeDate(e.target.value)}
            className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <p className="text-[10px] text-zinc-500 mt-1">
          Bankanın en son faiz kestiği tarih. İşleyen faiz bu tarihten bugüne kadar hesaplanır ve
          toplam borcunuza dahil edilir.
        </p>
      </div>

      {/* Canlı Günlük Faiz Sayacı & Simülasyon Paneli */}
      {accrual && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-zinc-900 to-zinc-900 border border-amber-500/30 shadow-[0_0_25px_rgba(245,158,11,0.1)] space-y-3">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
            <Lightning size={18} weight="fill" className="text-amber-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Anlık İşleyen Faiz ve Günlük Maliyet
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-zinc-400">Günlük Net Maliyet</p>
              <p className="text-base font-bold text-amber-400 font-mono">
                {formatCurrency(accrual.dailyCost)} / gün
              </p>
              <p className="text-[9px] text-zinc-500">Her gece 00:00 tahakkuku</p>
            </div>

            <div>
              <p className="text-[11px] text-zinc-400">30 Günlük Faiz Yükü</p>
              <p className="text-sm font-semibold text-rose-400 font-mono">
                {formatCurrency(accrual.monthlyCost)}
              </p>
              <p className="text-[9px] text-zinc-500">Faiz + KKDF + BSMV</p>
            </div>

            <div>
              <p className="text-[11px] text-zinc-400">30 Gün Sonra Kapama</p>
              <p className="text-sm font-semibold text-white font-mono">
                {formatCurrency(accrual.monthlyTotalPayoff)}
              </p>
              <p className="text-[9px] text-zinc-500">Anapara + Biriken Faiz</p>
            </div>
          </div>
        </div>
      )}

      {/* Limit Kullanım Çubuğu */}
      <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400">Kullanım:</span>
          <span className="font-semibold text-amber-400">%{usageRatio.toFixed(1)}</span>
        </div>
        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${Math.min(100, usageRatio)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>Kalan Limit: {formatCurrency(Math.max(0, limit - usedAmount))}</span>
          <span>Toplam Limit: {formatCurrency(limit)}</span>
        </div>
      </div>
    </div>
  );
}
