"use client";

import { useState, useEffect } from "react";
import { Hash, Building } from "@phosphor-icons/react";

export interface PromissoryFormData {
  title: string;
  documentType: "SENET" | "CEK";
  documentNo?: string;
  drawee: string;
  amount: number;
  dueDate: string;
  notes?: string;
}

interface PromissoryFormProps {
  initialData?: Partial<PromissoryFormData>;
  onChange: (data: PromissoryFormData, isValid: boolean) => void;
}

export function PromissoryForm({ initialData, onChange }: PromissoryFormProps) {
  const [documentType, setDocumentType] = useState<"SENET" | "CEK">(
    initialData?.documentType || "SENET"
  );
  const [documentNo, setDocumentNo] = useState(initialData?.documentNo || "");
  const [drawee, setDrawee] = useState(initialData?.drawee || "");
  const [amount, setAmount] = useState<number>(initialData?.amount || 50000);
  const [dueDate, setDueDate] = useState(initialData?.dueDate || "");
  const [notes, setNotes] = useState(initialData?.notes || "");

  useEffect(() => {
    const docLabel = documentType === "SENET" ? "Senet" : "Çek";
    const title = `${docLabel}${documentNo ? ` (#${documentNo})` : ""} - ${drawee || "Ticari"}`;
    const isValid = drawee.trim().length > 0 && amount > 0 && dueDate.length > 0;

    onChange(
      {
        title,
        documentType,
        documentNo,
        drawee,
        amount,
        dueDate,
        notes,
      },
      isValid
    );
  }, [documentType, documentNo, drawee, amount, dueDate, notes]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-zinc-900 rounded-xl border border-white/5">
        <button
          type="button"
          onClick={() => setDocumentType("SENET")}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
            documentType === "SENET"
              ? "bg-cyan-500 text-zinc-950 font-bold"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Borç Senedi
        </button>
        <button
          type="button"
          onClick={() => setDocumentType("CEK")}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
            documentType === "CEK"
              ? "bg-cyan-500 text-zinc-950 font-bold"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Keşide Edilen Çek
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Keşideci / Lehdar (Muhatap) *
          </label>
          <div className="relative">
            <Building size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              required
              value={drawee}
              onChange={(e) => setDrawee(e.target.value)}
              placeholder="Örn: Anadolu Ticaret A.Ş."
              className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Evrak / Çek Numarası
          </label>
          <div className="relative">
            <Hash size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={documentNo}
              onChange={(e) => setDocumentNo(e.target.value)}
              placeholder="Örn: SN-2026/894"
              className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Ödenecek Tutar *</label>
          <div className="relative">
            <input
              type="number"
              min="1"
              step="100"
              required
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="50.000"
              className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500 font-mono text-base"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
              ₺
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Vade Tarihi *</label>
          <div className="relative">
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">Notlar</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="İlgili fatura veya sözleşme detayları..."
          className="w-full p-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500"
        />
      </div>
    </div>
  );
}
