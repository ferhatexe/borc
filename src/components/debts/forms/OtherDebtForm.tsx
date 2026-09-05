"use client";

import { useState, useEffect } from "react";
import { DotsThreeCircle } from "@phosphor-icons/react";

export interface OtherDebtFormData {
  title: string;
  amount: number;
  dueDate?: string;
  notes?: string;
}

interface OtherDebtFormProps {
  initialData?: Partial<OtherDebtFormData>;
  institutionName?: string;
  onChange: (data: OtherDebtFormData, isValid: boolean) => void;
}

export function OtherDebtForm({ initialData, institutionName, onChange }: OtherDebtFormProps) {
  const [title, setTitle] = useState(
    initialData?.title || (institutionName ? `${institutionName} Borcu` : "Genel Borç Kaydı")
  );
  const [amount, setAmount] = useState<number>(initialData?.amount || 10000);
  const [dueDate, setDueDate] = useState(initialData?.dueDate || "");
  const [notes, setNotes] = useState(initialData?.notes || "");

  useEffect(() => {
    const isValid = title.trim().length > 0 && amount > 0;
    onChange(
      {
        title,
        amount,
        dueDate: dueDate || undefined,
        notes,
      },
      isValid
    );
  }, [title, amount, dueDate, notes]);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">Borç Başlığı *</label>
        <div className="relative">
          <DotsThreeCircle
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: Özel protokol ödemesi"
            className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Toplam Tutar *</label>
          <div className="relative">
            <input
              type="number"
              min="1"
              step="100"
              required
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="10.000"
              className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-zinc-500 font-mono text-base"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
              ₺
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Vade Tarihi (Opsiyonel)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">Notlar & Açıklama</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Borcun ayrıntıları ve detayları..."
          className="w-full p-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-zinc-500"
        />
      </div>
    </div>
  );
}
