"use client";

import { useState } from "react";
import { CaretDown, CheckCircle } from "@phosphor-icons/react";
import { formatCurrency, formatDateTR, formatNumber } from "@/lib/formatters";
import { haptics } from "@/lib/haptics";

export interface ScheduleRow {
  id: string;
  installmentNo: number;
  dueDate: string | Date;
  totalAmount: number | string;
  principalPart: number | string;
  interestPart: number | string;
  remainingPrincipal: number | string;
  status: string;
  paidAt?: string | Date | null;
  paidAmount?: number | string | null;
}

const VISIBLE_UPCOMING = 6;

function dayLabel(due: string | Date): { text: string; late: boolean } {
  const d = new Date(due);
  const today = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((a - b) / 86_400_000);
  if (diff === 0) return { text: "bugün", late: false };
  if (diff === 1) return { text: "yarın", late: false };
  if (diff > 1) return { text: `${diff} gün sonra`, late: false };
  return { text: `${-diff} gün gecikti`, late: true };
}

/**
 * Taksit takvimi.
 *
 * Eski hâli sekiz sütunlu bir tabloydu; telefonda yana kayıyor, her satırda
 * aynı siyah düğme tekrarlanıyor, ödenmiş-ödenmemiş her şey aynı ağırlıkta
 * duruyordu. Burada öncelik sırası var:
 *   1. sıradaki taksit: büyük, tek düğmeli kart,
 *   2. kalan taksitler: tek satır, tarih ve tutar,
 *   3. ödenmişler ve anapara/faiz dökümü: istenince açılır.
 */
export function InstallmentSchedule({
  rows,
  onPay,
}: {
  rows: ScheduleRow[];
  onPay: (row: ScheduleRow) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const paid = rows.filter((r) => r.status === "ODENDI");
  const pending = rows.filter((r) => r.status !== "ODENDI");
  const next = pending[0];
  const rest = pending.slice(1);
  const visibleRest = showAll ? rest : rest.slice(0, VISIBLE_UPCOMING);
  const hiddenCount = rest.length - visibleRest.length;

  const breakdown = (r: ScheduleRow) => (
    <p className="mt-0.5 font-mono text-[10px] tabular-nums text-zinc-500">
      anapara {formatNumber(r.principalPart, 2)} · faiz {formatNumber(r.interestPart, 2)} · kalan{" "}
      {formatNumber(r.remainingPrincipal, 2)}
    </p>
  );

  const toggle = (set: (fn: (v: boolean) => boolean) => void) => () => {
    haptics.selection();
    set((v) => !v);
  };

  return (
    <section aria-labelledby="taksitler-baslik" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="taksitler-baslik" className="text-sm font-semibold text-white">
          Taksitler
        </h3>
        <span className="text-xs text-zinc-400">
          {pending.length} kalan · {paid.length} ödendi
        </span>
      </div>

      {/* 1) Sıradaki taksit */}
      {next ? (
        <div className="glass-card flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Sıradaki taksit · #{next.installmentNo}
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
              {formatCurrency(next.totalAmount)}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {formatDateTR(next.dueDate)} ·{" "}
              <span className={dayLabel(next.dueDate).late ? "font-semibold text-rose-400" : ""}>
                {dayLabel(next.dueDate).text}
              </span>
            </p>
            {showBreakdown && breakdown(next)}
          </div>
          <button
            type="button"
            onClick={() => onPay(next)}
            className="h-12 shrink-0 rounded-2xl bg-emerald-500 px-6 text-sm font-bold text-zinc-950 active:scale-95"
          >
            Öde
          </button>
        </div>
      ) : (
        <div className="glass-card flex items-center gap-2.5 p-4 text-sm font-medium text-emerald-400">
          <CheckCircle size={20} weight="fill" />
          Bütün taksitler ödendi.
        </div>
      )}

      {/* 2) Kalan taksitler */}
      {rest.length > 0 && (
        <div className="glass-card overflow-hidden p-0">
          <ul className="divide-y divide-white/5">
            {visibleRest.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-7 shrink-0 font-mono text-[11px] text-zinc-500">
                  #{r.installmentNo}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-zinc-300">{formatDateTR(r.dueDate)}</span>
                    <span className="whitespace-nowrap font-mono text-[13px] font-semibold tabular-nums text-white">
                      {formatCurrency(r.totalAmount)}
                    </span>
                  </div>
                  {showBreakdown && breakdown(r)}
                </div>
                <button
                  type="button"
                  onClick={() => onPay(r)}
                  aria-label={`${r.installmentNo}. taksiti öde`}
                  className="h-8 shrink-0 rounded-lg border border-white/15 px-3 text-xs font-semibold text-zinc-300 hover:text-white active:scale-95"
                >
                  Öde
                </button>
              </li>
            ))}
          </ul>
          {rest.length > VISIBLE_UPCOMING && (
            <button
              type="button"
              onClick={toggle(setShowAll)}
              aria-expanded={showAll}
              className="flex w-full items-center justify-center gap-1.5 border-t border-white/5 py-2.5 text-xs font-medium text-zinc-400 hover:text-white"
            >
              {showAll ? "Daha az göster" : `Kalan ${hiddenCount} taksiti göster`}
              <CaretDown size={12} weight="bold" className={showAll ? "rotate-180" : ""} />
            </button>
          )}
        </div>
      )}

      {/* 3) İstenince açılanlar */}
      <div className="flex flex-wrap gap-2">
        {paid.length > 0 && (
          <button
            type="button"
            onClick={toggle(setShowPaid)}
            aria-expanded={showPaid}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-zinc-300 active:scale-95"
          >
            {showPaid ? "Ödenenleri gizle" : `Ödenen ${paid.length} taksit`}
            <CaretDown size={12} weight="bold" className={showPaid ? "rotate-180" : ""} />
          </button>
        )}
        <button
          type="button"
          onClick={toggle(setShowBreakdown)}
          aria-pressed={showBreakdown}
          className="flex h-9 items-center rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-zinc-300 active:scale-95"
        >
          {showBreakdown ? "Dökümü gizle" : "Anapara / faiz dökümü"}
        </button>
      </div>

      {showPaid && paid.length > 0 && (
        <ul className="glass-card divide-y divide-white/5 overflow-hidden p-0">
          {paid.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <CheckCircle size={16} weight="fill" className="w-7 shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-zinc-400">
                    #{r.installmentNo} · {formatDateTR(r.paidAt ?? r.dueDate)} ödendi
                  </span>
                  <span className="whitespace-nowrap font-mono text-[13px] tabular-nums text-zinc-300">
                    {formatCurrency(r.paidAmount ?? r.totalAmount)}
                  </span>
                </div>
                {showBreakdown && breakdown(r)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
