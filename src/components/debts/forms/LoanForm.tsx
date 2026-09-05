"use client";

import { useState, useMemo, useEffect } from "react";
import Decimal from "decimal.js";
import {
  calculateAnnuityInstallment,
  solveMonthlyInterestRate,
} from "@/lib/finance/annuity";
import { dayOfMonthFromInput, formatCurrency, toDateInputValue } from "@/lib/formatters";
import { useAppSettings } from "@/lib/hooks/useAppSettings";
import {
  Calculator,
  Car,
  House,
  Briefcase,
  GraduationCap,
  Sparkle,
} from "@phosphor-icons/react";

export interface LoanFormData {
  loanSubType: string;
  principal: number;
  interestRateMonthly: number;
  installmentCount: number;
  installmentAmount: number;
  includeKKDF: boolean;
  kkdfRate: number;
  includeBSMV: boolean;
  bsmvRate: number;
  firstPaymentDate: string;
  paymentDayOfMonth: number;
  loanAccountNo?: string;
  title: string;
  notes?: string;
}

interface LoanFormProps {
  initialData?: Partial<LoanFormData>;
  institutionName?: string;
  onChange: (data: LoanFormData, isValid: boolean) => void;
}

const SUBTYPES = [
  { id: "IHTIYAC", label: "İhtiyaç Kredisi", icon: Calculator, desc: "Bireysel nakit ihtiyaçları" },
  { id: "TASIT", label: "Taşıt Kredisi", icon: Car, desc: "0 km veya 2. el araç finansmanı" },
  { id: "KONUT", label: "Konut Kredisi", icon: House, desc: "Ev / Gayrimenkul (KKDF & BSMV Muaf)" },
  { id: "EGITIM", label: "Eğitim Kredisi", icon: GraduationCap, desc: "Okul / Kurs finansmanı" },
  { id: "KOBI", label: "KOBİ / Ticari Kredi", icon: Briefcase, desc: "İşletme finansmanı" },
];

const TERM_PRESETS = [6, 12, 18, 24, 36, 48, 60, 120];

export function LoanForm({ initialData, institutionName, onChange }: LoanFormProps) {
  // KKDF / BSMV oranlari koda gomulu degil, Ayarlar'dan okunur (sartname 11).
  const { settings } = useAppSettings();
  const kkdfRate = settings.taxRates.kkdfRate;
  const bsmvRate = settings.taxRates.bsmvRate;

  const [loanSubType, setLoanSubType] = useState(initialData?.loanSubType || "IHTIYAC");
  const [calcMode, setCalcMode] = useState<"RATE_TO_INSTALLMENT" | "INSTALLMENT_TO_RATE">("RATE_TO_INSTALLMENT");

  const [principal, setPrincipal] = useState<number>(initialData?.principal ?? 0);
  const [interestRateMonthly, setInterestRateMonthly] = useState<number>(
    initialData?.interestRateMonthly !== undefined ? initialData.interestRateMonthly : 0
  );
  const [installmentCount, setInstallmentCount] = useState<number>(
    initialData?.installmentCount || 12
  );
  const [targetInstallmentAmount, setTargetInstallmentAmount] = useState<number>(
    initialData?.installmentAmount ?? 0
  );

  const [includeKKDF, setIncludeKKDF] = useState<boolean>(
    initialData?.includeKKDF !== undefined ? initialData.includeKKDF : true
  );
  const [includeBSMV, setIncludeBSMV] = useState<boolean>(
    initialData?.includeBSMV !== undefined ? initialData.includeBSMV : true
  );

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const defaultFirstDate = toDateInputValue(nextMonth);

  const [firstPaymentDate, setFirstPaymentDate] = useState<string>(
    initialData?.firstPaymentDate || defaultFirstDate
  );
  const [paymentDayOfMonth, setPaymentDayOfMonth] = useState<number>(
    initialData?.paymentDayOfMonth || nextMonth.getDate()
  );
  const [loanAccountNo, setLoanAccountNo] = useState<string>(initialData?.loanAccountNo || "");
  const [title, setTitle] = useState<string>(
    initialData?.title || `${institutionName || "Banka"} İhtiyaç Kredisi`
  );
  const [notes, setNotes] = useState<string>(initialData?.notes || "");

  // Konut kredisi seçildiğinde KKDF ve BSMV otomatik kapansın
  useEffect(() => {
    if (loanSubType === "KONUT") {
      setIncludeKKDF(false);
      setIncludeBSMV(false);
    }
  }, [loanSubType]);

  // Title otomatik güncelleme (kullanıcı elle değiştirmediyse)
  useEffect(() => {
    const subLabel = SUBTYPES.find((s) => s.id === loanSubType)?.label || "Kredi";
    setTitle(`${institutionName || "Banka"} ${subLabel}`);
  }, [loanSubType, institutionName]);

  // Çift Yönlü Hesaplama
  const calculation = useMemo(() => {
    try {
      if (principal <= 0 || installmentCount <= 0) return null;

      if (calcMode === "RATE_TO_INSTALLMENT") {
        const res = calculateAnnuityInstallment({
          principal,
          monthlyInterestRatePercent: interestRateMonthly,
          installmentCount,
          includeKKDF,
          kkdfRate,
          includeBSMV,
          bsmvRate,
        });

        const effectiveAnnual = res.effectiveMonthlyRate
          .plus(1)
          .pow(12)
          .minus(1)
          .times(100);

        return {
          installmentAmount: res.installmentAmount.toNumber(),
          effectiveMonthlyRate: res.effectiveMonthlyRate.times(100).toNumber(),
          effectiveAnnualRate: effectiveAnnual.toNumber(),
          totalPayment: res.totalPayment.toNumber(),
          totalInterest: res.totalInterest.toNumber(),
          solvedMonthlyRate: interestRateMonthly,
        };
      } else {
        // Taksitten Faizi Çöz
        const solved = solveMonthlyInterestRate(
          principal,
          targetInstallmentAmount,
          installmentCount,
          includeKKDF,
          includeBSMV,
          kkdfRate,
          bsmvRate
        );

        const res = calculateAnnuityInstallment({
          principal,
          monthlyInterestRatePercent: solved.rawMonthlyRatePercent,
          installmentCount,
          includeKKDF,
          kkdfRate,
          includeBSMV,
          bsmvRate,
        });

        const effectiveAnnual = res.effectiveMonthlyRate
          .plus(1)
          .pow(12)
          .minus(1)
          .times(100);

        return {
          installmentAmount: targetInstallmentAmount,
          effectiveMonthlyRate: solved.effectiveMonthlyRatePercent.toNumber(),
          effectiveAnnualRate: effectiveAnnual.toNumber(),
          totalPayment: new Decimal(targetInstallmentAmount).times(installmentCount).toNumber(),
          totalInterest: new Decimal(targetInstallmentAmount)
            .times(installmentCount)
            .minus(principal)
            .toNumber(),
          solvedMonthlyRate: solved.rawMonthlyRatePercent.toNumber(),
        };
      }
    } catch {
      return null;
    }
  }, [
    calcMode,
    principal,
    interestRateMonthly,
    installmentCount,
    targetInstallmentAmount,
    includeKKDF,
    includeBSMV,
    kkdfRate,
    bsmvRate,
  ]);

  // Form Değişiklik Bildirimi
  useEffect(() => {
    const isValid =
      principal > 0 &&
      installmentCount > 0 &&
      (calcMode === "RATE_TO_INSTALLMENT" ? interestRateMonthly >= 0 : targetInstallmentAmount > 0) &&
      title.trim().length > 0;

    const finalRate =
      calcMode === "RATE_TO_INSTALLMENT"
        ? interestRateMonthly
        : calculation?.solvedMonthlyRate || 0;
    const finalInstallment =
      calcMode === "RATE_TO_INSTALLMENT"
        ? calculation?.installmentAmount || 0
        : targetInstallmentAmount;

    onChange(
      {
        loanSubType,
        principal,
        interestRateMonthly: finalRate,
        installmentCount,
        installmentAmount: finalInstallment,
        includeKKDF,
        kkdfRate,
        includeBSMV,
        bsmvRate,
        firstPaymentDate,
        paymentDayOfMonth: Number(paymentDayOfMonth),
        loanAccountNo,
        title,
        notes,
      },
      isValid
    );
  }, [
    loanSubType,
    principal,
    interestRateMonthly,
    installmentCount,
    targetInstallmentAmount,
    includeKKDF,
    includeBSMV,
    firstPaymentDate,
    paymentDayOfMonth,
    loanAccountNo,
    title,
    notes,
    calcMode,
    calculation,
    kkdfRate,
    bsmvRate,
  ]);

  return (
    <div className="space-y-6">
      {/* Subtype Selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-300">Kredi Alt Türü</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SUBTYPES.map((st) => {
            const Icon = st.icon;
            const isSel = loanSubType === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setLoanSubType(st.id)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                  isSel
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
                    : "bg-zinc-900/40 border-white/5 text-zinc-400 hover:bg-zinc-900/70"
                }`}
              >
                <Icon size={18} weight={isSel ? "fill" : "duotone"} />
                <span className="text-xs font-medium truncate">{st.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode Switch (Bidirectional) */}
      <div className="flex items-center justify-between p-1 bg-zinc-900/70 rounded-xl border border-white/5">
        <button
          type="button"
          onClick={() => setCalcMode("RATE_TO_INSTALLMENT")}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
            calcMode === "RATE_TO_INSTALLMENT"
              ? "bg-emerald-500 text-zinc-950 font-semibold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Aylık Faiz Oranı Belli
        </button>
        <button
          type="button"
          onClick={() => setCalcMode("INSTALLMENT_TO_RATE")}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
            calcMode === "INSTALLMENT_TO_RATE"
              ? "bg-emerald-500 text-zinc-950 font-semibold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Aylık Taksit Tutarı Belli
        </button>
      </div>

      {/* Main Loan Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Kredi Başlığı */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Kredi Tanımı / Başlık *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: QNB İhtiyaç Kredisi"
            className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Anapara Tutarı */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Kredi Tutarı (Anapara) *
          </label>
          <div className="relative">
            <input
              type="number"
              min="100"
              step="100"
              required
              value={principal || ""}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              placeholder="100.000"
              className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono text-base"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
              ₺
            </span>
          </div>
        </div>

        {/* Faiz Oranı veya Taksit Tutarı */}
        {calcMode === "RATE_TO_INSTALLMENT" ? (
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Aylık Akdi Faiz Oranı (%) *
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={interestRateMonthly || ""}
                onChange={(e) => setInterestRateMonthly(Number(e.target.value))}
                placeholder="3.89"
                className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono text-base"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
                %
              </span>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Ödenen Aylık Taksit Tutarı *
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="1"
                value={targetInstallmentAmount || ""}
                onChange={(e) => setTargetInstallmentAmount(Number(e.target.value))}
                placeholder="10.500"
                className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono text-base"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
                ₺
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Vade / Taksit Sayısı */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-300">Vade (Taksit Sayısı) *</label>
          <span className="text-xs font-semibold text-emerald-400">{installmentCount} Ay</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {TERM_PRESETS.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => setInstallmentCount(term)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                installmentCount === term
                  ? "bg-emerald-500 text-zinc-950 font-bold"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-white/5"
              }`}
            >
              {term} Ay
            </button>
          ))}
          <div className="w-24">
            <input
              type="number"
              min="1"
              max="360"
              value={installmentCount || ""}
              onChange={(e) => setInstallmentCount(Number(e.target.value))}
              placeholder="Özel"
              className="w-full h-[33px] px-2 text-center text-xs bg-zinc-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Taxes & Special Clauses */}
      <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2.5">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Vergi Muafiyetleri & Oranları
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeKKDF}
              onChange={(e) => setIncludeKKDF(e.target.checked)}
              className="h-4 w-4 rounded bg-zinc-800 border-white/20 text-emerald-500 focus:ring-0"
            />
            <div>
              <span className="text-xs font-medium text-zinc-200">KKDF Dahil (%{Math.round(kkdfRate * 100)})</span>
              <p className="text-[10px] text-zinc-500">Kaynak Kullanımını Destekleme Fonu</p>
            </div>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeBSMV}
              onChange={(e) => setIncludeBSMV(e.target.checked)}
              className="h-4 w-4 rounded bg-zinc-800 border-white/20 text-emerald-500 focus:ring-0"
            />
            <div>
              <span className="text-xs font-medium text-zinc-200">BSMV Dahil (%{Math.round(bsmvRate * 100)})</span>
              <p className="text-[10px] text-zinc-500">Banka ve Sigorta Muameleleri Vergisi</p>
            </div>
          </label>
        </div>
      </div>

      {/* Dates & Payment Day */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            İlk Taksit Vade Tarihi *
          </label>
          <div className="relative">
            <input
              type="date"
              required
              value={firstPaymentDate}
              onChange={(e) => {
                setFirstPaymentDate(e.target.value);
                // Ayin gunu yerel olarak okunur; new Date("2026-10-04") UTC
                // sayildigi icin plan bir gun kayabiliyordu.
                const day = dayOfMonthFromInput(e.target.value);
                if (day) setPaymentDayOfMonth(day);
              }}
              className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Kredi Hesap / Sözleşme No (Opsiyonel)
          </label>
          <input
            type="text"
            value={loanAccountNo}
            onChange={(e) => setLoanAccountNo(e.target.value)}
            placeholder="Örn: 104-5829-01"
            className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>
      </div>

      {/* Live Financial Summary Banner */}
      {calculation && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.1)] space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkle size={18} className="text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Finansal Hesaplama Özeti
              </span>
            </div>
            {calcMode === "INSTALLMENT_TO_RATE" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                Çözümlenen Faiz: %{calculation.solvedMonthlyRate.toFixed(2)}/ay
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div>
              <p className="text-[11px] text-zinc-400">Aylık Taksit Tutarı</p>
              <p className="text-base font-bold text-emerald-400 font-mono">
                {formatCurrency(calculation.installmentAmount)}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-zinc-400">Toplam Geri Ödeme</p>
              <p className="text-sm font-semibold text-white font-mono">
                {formatCurrency(calculation.totalPayment)}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-zinc-400">Toplam Faiz & Vergi</p>
              <p className="text-sm font-semibold text-rose-400 font-mono">
                {formatCurrency(calculation.totalInterest)}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-zinc-400">Yıllık Maliyet Oranı</p>
              <p className="text-sm font-semibold text-amber-400 font-mono">
                %{calculation.effectiveAnnualRate.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
