"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/formatters";
import { CreditCard, CalendarBlank, Sparkle } from "@phosphor-icons/react";
import { NotesField } from "./NotesField";

export interface CreditCardFormData {
  title: string;
  cardName: string;
  last4: string;
  creditLimit: number;
  currentStatementBalance: number;
  minimumPayment: number;
  statementDay: number;
  dueDay: number;
  contractualInterestMonthly: number;
  overdueInterestMonthly: number;
  notes?: string;
}

interface CreditCardFormProps {
  initialData?: Partial<CreditCardFormData>;
  institutionName?: string;
  onChange: (data: CreditCardFormData, isValid: boolean) => void;
}

export function CreditCardForm({ initialData, institutionName, onChange }: CreditCardFormProps) {
  const [cardName, setCardName] = useState(
    initialData?.cardName || `${institutionName || "Banka"} Kredi Kartı`
  );
  const [last4, setLast4] = useState(initialData?.last4 || "");
  const [creditLimit, setCreditLimit] = useState<number>(initialData?.creditLimit ?? 0);
  const [currentStatementBalance, setCurrentStatementBalance] = useState<number>(
    initialData?.currentStatementBalance ?? 0
  );
  const [minimumPayment, setMinimumPayment] = useState<number>(
    initialData?.minimumPayment ?? 0
  );
  const [statementDay, setStatementDay] = useState<number>(initialData?.statementDay || 15);
  const [dueDay, setDueDay] = useState<number>(initialData?.dueDay || 25);
  const [contractualInterestMonthly, setContractualInterestMonthly] = useState<number>(
    initialData?.contractualInterestMonthly ?? 0
  );
  const [overdueInterestMonthly, setOverdueInterestMonthly] = useState<number>(
    initialData?.overdueInterestMonthly ?? 0
  );
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Asgari ödeme kuralı: 25.000 TL altı limitlerde %20, 25.000 TL ve üstü limitlerde %40 (BDDK Kuralı)
  const calculateDefaultMinPayment = () => {
    const minRatio = creditLimit >= 25000 ? 0.4 : 0.2;
    return Math.round(currentStatementBalance * minRatio);
  };

  const handleApplyDefaultMinPayment = () => {
    setMinimumPayment(calculateDefaultMinPayment());
  };

  const remainingLimit = Math.max(0, creditLimit - currentStatementBalance);
  const limitUsageRatio = creditLimit > 0 ? (currentStatementBalance / creditLimit) * 100 : 0;

  useEffect(() => {
    const title = `${cardName}${last4 ? ` (*${last4})` : ""}`;
    const isValid =
      cardName.trim().length > 0 &&
      creditLimit > 0 &&
      currentStatementBalance >= 0 &&
      statementDay >= 1 &&
      statementDay <= 31 &&
      dueDay >= 1 &&
      dueDay <= 31;

    onChange(
      {
        title,
        cardName,
        last4,
        creditLimit,
        currentStatementBalance,
        minimumPayment,
        statementDay: Number(statementDay),
        dueDay: Number(dueDay),
        contractualInterestMonthly,
        overdueInterestMonthly,
        notes,
      },
      isValid
    );
  }, [
    cardName,
    last4,
    creditLimit,
    currentStatementBalance,
    minimumPayment,
    statementDay,
    dueDay,
    contractualInterestMonthly,
    overdueInterestMonthly,
    notes,
  ]);

  return (
    <div className="space-y-6">
      {/* Kart Kimliği */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Kart Adı / Modeli *
          </label>
          <div className="relative">
            <CreditCard
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              required
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Örn: Garanti Bonus Platinum"
              className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Son 4 Hane</label>
          <input
            type="text"
            maxLength={4}
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
            placeholder="4821"
            className="w-full h-11 px-3.5 text-center text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono tracking-widest text-sm"
          />
        </div>
      </div>

      {/* Limit & Güncel Borç */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Toplam Kart Limiti *
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="500"
              required
              value={creditLimit || ""}
              onChange={(e) => setCreditLimit(Number(e.target.value))}
              placeholder="50.000"
              className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono text-base"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
              ₺
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Güncel Dönem Borcu *
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="100"
              required
              value={currentStatementBalance || ""}
              onChange={(e) => setCurrentStatementBalance(Number(e.target.value))}
              placeholder="15.000"
              className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono text-base"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
              ₺
            </span>
          </div>
        </div>
      </div>

      {/* Asgari Ödeme Tutarı */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-zinc-300">Asgari Ödeme Tutarı</label>
          <button
            type="button"
            onClick={handleApplyDefaultMinPayment}
            className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
          >
            <Sparkle size={14} />
            <span>BDDK Oranıyla Doldur ({creditLimit >= 25000 ? "%40" : "%20"})</span>
          </button>
        </div>
        <div className="relative">
          <input
            type="number"
            min="0"
            step="50"
            value={minimumPayment || ""}
            onChange={(e) => setMinimumPayment(Number(e.target.value))}
            placeholder="3.000"
            className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono text-base"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
            ₺
          </span>
        </div>
      </div>

      {/* Tarihler (Kesim ve Son Ödeme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Hesap Kesim Günü (Ayın Kaçı?) *
          </label>
          <div className="relative">
            <CalendarBlank
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="number"
              min="1"
              max="31"
              required
              value={statementDay || ""}
              onChange={(e) => setStatementDay(Number(e.target.value))}
              placeholder="15"
              className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono text-base"
            />
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Her ayın {statementDay}. günü ekstre kesilir</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Son Ödeme Günü (Ayın Kaçı?) *
          </label>
          <div className="relative">
            <CalendarBlank
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="number"
              min="1"
              max="31"
              required
              value={dueDay || ""}
              onChange={(e) => setDueDay(Number(e.target.value))}
              placeholder="25"
              className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono text-base"
            />
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Her ayın {dueDay}. günü son ödeme</p>
        </div>
      </div>

      {/* Faiz Oranları (Akdi & Gecikme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-zinc-900/40 border border-white/5">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Aylık Akdi Faiz Oranı (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={contractualInterestMonthly}
            onChange={(e) => setContractualInterestMonthly(Number(e.target.value))}
            className="w-full h-9 px-3 text-xs bg-zinc-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
          />
          <p className="text-[10px] text-zinc-500 mt-0.5">TCMB Tavanı: %4.25</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Gecikme Faizi Oranı (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={overdueInterestMonthly}
            onChange={(e) => setOverdueInterestMonthly(Number(e.target.value))}
            className="w-full h-9 px-3 text-xs bg-zinc-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
          />
          <p className="text-[10px] text-zinc-500 mt-0.5">TCMB Tavanı: %4.55</p>
        </div>
      </div>

      {/* Kart Kullanım Göstergesi */}
      <div className="p-4 rounded-2xl bg-zinc-900 border border-blue-500/20 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Limit Kullanım Oranı:</span>
          <span className={`font-bold font-mono ${limitUsageRatio > 80 ? "text-rose-400" : "text-blue-400"}`}>
            %{limitUsageRatio.toFixed(1)}
          </span>
        </div>

        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              limitUsageRatio > 80 ? "bg-rose-500" : limitUsageRatio > 50 ? "bg-amber-500" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(100, limitUsageRatio)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span>Kullanılabilir Limit: {formatCurrency(remainingLimit)}</span>
          <span>Toplam: {formatCurrency(creditLimit)}</span>
        </div>
      </div>

      <NotesField value={notes} onChange={setNotes} />
    </div>
  );
}
