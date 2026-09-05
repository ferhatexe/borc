"use client";

import { useState, useEffect } from "react";
import { UsersThree, Phone } from "@phosphor-icons/react";

export interface PersonalDebtFormData {
  title: string;
  creditorName: string;
  creditorPhone?: string;
  amount: number;
  currency: "TRY" | "USD" | "EUR";
  dueDate?: string;
  hasInterest: boolean;
  notes?: string;
}

interface PersonalDebtFormProps {
  initialData?: Partial<PersonalDebtFormData>;
  onChange: (data: PersonalDebtFormData, isValid: boolean) => void;
}

export function PersonalDebtForm({ initialData, onChange }: PersonalDebtFormProps) {
  const [creditorName, setCreditorName] = useState(initialData?.creditorName || "");
  const [creditorPhone, setCreditorPhone] = useState(initialData?.creditorPhone || "");
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [currency, setCurrency] = useState<"TRY" | "USD" | "EUR">(initialData?.currency || "TRY");
  const [dueDate, setDueDate] = useState(initialData?.dueDate || "");
  const [hasInterest, setHasInterest] = useState(initialData?.hasInterest || false);
  const [notes, setNotes] = useState(initialData?.notes || "");

  useEffect(() => {
    const title = `${creditorName ? `${creditorName} Borcu` : "Kişi Borcu"}`;
    const isValid = creditorName.trim().length > 0 && amount > 0;

    onChange(
      {
        title,
        creditorName,
        creditorPhone,
        amount,
        currency,
        dueDate: dueDate || undefined,
        hasInterest,
        notes,
      },
      isValid
    );
  }, [creditorName, creditorPhone, amount, currency, dueDate, hasInterest, notes]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Borç Alınan Kişi / Muhatap *
          </label>
          <div className="relative">
            <UsersThree
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              required
              value={creditorName}
              onChange={(e) => setCreditorName(e.target.value)}
              placeholder="Örn: Ahmet Yılmaz (Kuzen)"
              className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Telefon Numarası (Opsiyonel)
          </label>
          <div className="relative">
            <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="tel"
              value={creditorPhone}
              onChange={(e) => setCreditorPhone(e.target.value)}
              placeholder="0532 000 00 00"
              className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Borç Tutarı *</label>
          <div className="relative">
            <input
              type="number"
              min="1"
              step="100"
              required
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="25.000"
              className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 font-mono text-base"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
              {currency === "TRY" ? "₺" : currency}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Para Birimi</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
            className="w-full h-11 px-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
          >
            <option value="TRY">Türk Lirası (TRY)</option>
            <option value="USD">Amerikan Doları (USD)</option>
            <option value="EUR">Euro (EUR)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Sözleşilen Geri Ödeme Tarihi
          </label>
          <div className="relative">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex items-center pt-6">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={hasInterest}
              onChange={(e) => setHasInterest(e.target.checked)}
              className="h-4 w-4 rounded bg-zinc-800 border-white/20 text-purple-500 focus:ring-0"
            />
            <div>
              <span className="text-xs font-medium text-zinc-200">Faiz / Fark Ödemesi Var</span>
              <p className="text-[10px] text-zinc-500">Ana paraya ilave mutabakat var</p>
            </div>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
          Açıklama / Borç Sebebi
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Borcun vadesi ve sözleşilen özel koşullar..."
          className="w-full p-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
        />
      </div>
    </div>
  );
}
