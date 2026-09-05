"use client";

import { useState, useEffect } from "react";
import { CalendarCheck, Repeat } from "@phosphor-icons/react";

export interface RecurringFormData {
  title: string;
  amount: number;
  frequency: "AYLIK" | "UC_AYLIK" | "ALTI_AYLIK" | "YILLIK";
  nextDueDate: string;
  autoCreateExpense: boolean;
  notes?: string;
}

interface RecurringFormProps {
  initialData?: Partial<RecurringFormData>;
  institutionName?: string;
  onChange: (data: RecurringFormData, isValid: boolean) => void;
}

export function RecurringForm({ initialData, institutionName, onChange }: RecurringFormProps) {
  const [title, setTitle] = useState(
    initialData?.title || (institutionName ? `${institutionName} Ödemesi` : "Ev Kirası")
  );
  const [amount, setAmount] = useState<number>(initialData?.amount || 15000);
  const [frequency, setFrequency] = useState<"AYLIK" | "UC_AYLIK" | "ALTI_AYLIK" | "YILLIK">(
    initialData?.frequency || "AYLIK"
  );

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const defaultNextDate = nextMonth.toISOString().split("T")[0];

  const [nextDueDate, setNextDueDate] = useState(initialData?.nextDueDate || defaultNextDate);
  const [autoCreateExpense, setAutoCreateExpense] = useState(
    initialData?.autoCreateExpense !== undefined ? initialData.autoCreateExpense : true
  );
  const [notes, setNotes] = useState(initialData?.notes || "");

  useEffect(() => {
    const isValid = title.trim().length > 0 && amount > 0 && nextDueDate.length > 0;
    onChange(
      {
        title,
        amount,
        frequency,
        nextDueDate,
        autoCreateExpense,
        notes,
      },
      isValid
    );
  }, [title, amount, frequency, nextDueDate, autoCreateExpense, notes]);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
          Ödeme Tanımı / Başlık *
        </label>
        <div className="relative">
          <CalendarCheck
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: Ev Kirası, Site Aidatı, Spor Salonu"
            className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Periyodik Tutar *</label>
          <div className="relative">
            <input
              type="number"
              min="1"
              step="50"
              required
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="15.000"
              className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500 font-mono text-base"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
              ₺
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tekrar Sıklığı</label>
          <div className="relative">
            <Repeat size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
            >
              <option value="AYLIK">Her Ay</option>
              <option value="UC_AYLIK">3 Ayda Bir</option>
              <option value="ALTI_AYLIK">6 Ayda Bir</option>
              <option value="YILLIK">Yılda Bir</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            İlk / Bir Sonraki Ödeme Tarihi *
          </label>
          <input
            type="date"
            required
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center pt-6">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreateExpense}
              onChange={(e) => setAutoCreateExpense(e.target.checked)}
              className="h-4 w-4 rounded bg-zinc-800 border-white/20 text-rose-500 focus:ring-0"
            />
            <div>
              <span className="text-xs font-medium text-zinc-200">Giderlere Otomatik Kaydet</span>
              <p className="text-[10px] text-zinc-500">Ödendiğinde harcama geçmişine işler</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
