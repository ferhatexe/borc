"use client";

import { useMemo } from "react";
import { CalendarCheck, WarningOctagon } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/formatters";
import { useLiveData } from "./LiveDataProvider";
import { OverdueList } from "./OverdueList";
import { UpcomingList } from "./UpcomingList";
import type { UpcomingPayment } from "@/lib/finance/debtValuation";

interface OverduePageClientProps {
  initialPayments: UpcomingPayment[];
  initialUpcoming: UpcomingPayment[];
  initialOverdueTL: number;
}

/**
 * Overdue screen. Renders the server-computed list immediately, then keeps it
 * in sync with the same live poll the dashboard uses, so paying an item here
 * updates the totals everywhere without a full reload.
 */
export function OverduePageClient({
  initialPayments,
  initialUpcoming,
  initialOverdueTL,
}: OverduePageClientProps) {
  const live = useLiveData();
  const data = live?.data ?? null;
  const refresh = live?.refresh ?? (async () => {});

  const payments = data?.overduePayments ?? initialPayments;
  const overdueTL = data?.totals.overdueTL ?? initialOverdueTL;
  const upcoming = useMemo(
    () => (data ? data.upcomingPayments.filter((p) => !p.isOverdue) : initialUpcoming),
    [data, initialUpcoming]
  );

  const worstDays = payments.length ? Math.abs(payments[0].daysUntilDue) : 0;

  return (
    <div className="space-y-6">
      {payments.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.09] p-4">
          <div className="flex items-center gap-2 text-rose-300">
            <WarningOctagon size={20} weight="fill" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Ödeme yapılmadı
            </span>
          </div>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-rose-200">
            {formatCurrency(overdueTL)}
          </p>
          <p className="mt-1 text-xs text-rose-200/70">
            {payments.length} kalem · en eskisi {worstDays} gün gecikti
          </p>
        </div>
      )}

      <section>
        <h2 className="mb-2.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Geciken kalemler
        </h2>
        <OverdueList payments={payments} onPaid={() => void refresh(true)} />
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2.5 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <CalendarCheck size={13} />
            Yaklaşan ödemeler (30 gün)
          </h2>
          <UpcomingList payments={upcoming} />
        </section>
      )}
    </div>
  );
}
