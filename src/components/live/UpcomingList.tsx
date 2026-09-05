"use client";

import Link from "next/link";
import { Clock } from "@phosphor-icons/react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { InstitutionLogo } from "@/components/shared/InstitutionLogo";
import type { UpcomingPayment } from "@/lib/finance/debtValuation";

/** Payments coming due, newest first, with the days remaining. */
export function UpcomingList({
  payments,
  limit,
}: {
  payments: UpcomingPayment[];
  limit?: number;
}) {
  const rows = limit ? payments.slice(0, limit) : payments;

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center">
        <p className="text-xs text-zinc-400">Önümüzdeki 30 günde ödeme yok.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5" role="list">
      {rows.map((p) => (
        <li key={`${p.debtId}-${p.installmentId ?? p.dueDate}`}>
          <Link
            href={`/debts/${p.debtId}`}
            className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] p-2.5 transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
          >
            <InstitutionLogo
              name={p.institutionName ?? p.title}
              color={p.institutionColor}
              type={p.institutionType ?? (p.institutionName ? "BANKA" : "KISI")}
              size={34}
              motifOnly
            />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-zinc-100">{p.title}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
                <Clock size={11} />
                {formatDate(p.dueDate)}
                <span className="text-zinc-400">
                  · {p.daysUntilDue === 0 ? "bugün" : `${p.daysUntilDue} gün kaldı`}
                </span>
              </span>
            </div>
            <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-zinc-100">
              {formatCurrency(p.amountTL)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
