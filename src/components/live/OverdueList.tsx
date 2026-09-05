"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, Clock, WarningOctagon, ArrowRight } from "@phosphor-icons/react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { triggerHaptic } from "@/lib/haptics";
import { InstitutionLogo } from "@/components/shared/InstitutionLogo";
import type { UpcomingPayment } from "@/lib/finance/debtValuation";

const KIND_LABELS: Record<UpcomingPayment["kind"], string> = {
  TAKSIT: "Kredi taksiti",
  KART: "Kredi kartı",
  DUZENLI: "Düzenli ödeme",
  SENET: "Senet / çek",
  ALTIN: "Altın borcu",
  KISI: "Kişi borcu",
};

interface OverdueListProps {
  payments: UpcomingPayment[];
  /** Compact mode hides the pay button and caps the list. */
  compact?: boolean;
  limit?: number;
  onPaid?: () => void;
}

/** How alarming the row looks, by how late it is. */
function severity(days: number) {
  if (days >= 30) return { ring: "border-rose-500/50 bg-rose-500/[0.12]", text: "text-rose-300" };
  if (days >= 7) return { ring: "border-orange-500/40 bg-orange-500/[0.09]", text: "text-orange-300" };
  return { ring: "border-amber-500/35 bg-amber-500/[0.07]", text: "text-amber-300" };
}

/**
 * "Ödemesi geçti, ödeme yapmadınız" list.
 *
 * Every unpaid item whose due date has passed, oldest first, with a one-tap
 * payment action that also books the matching expense.
 */
export function OverdueList({ payments, compact = false, limit, onPaid }: OverdueListProps) {
  const router = useRouter();
  const [payingId, setPayingId] = useState<string | null>(null);

  const rows = limit ? payments.slice(0, limit) : payments;

  const pay = async (payment: UpcomingPayment) => {
    const key = `${payment.debtId}-${payment.installmentId ?? payment.dueDate}`;
    setPayingId(key);
    try {
      const res = await fetch(`/api/debts/${payment.debtId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentId: payment.installmentId ?? undefined,
          amount: payment.amountTL,
          method: "HAVALE",
          createExpense: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ödeme kaydedilemedi");

      triggerHaptic("success");
      toast.success(
        data.expense
          ? `${payment.title}: ödeme ve gider kaydı oluşturuldu.`
          : `${payment.title}: ödeme kaydedildi.`
      );
      onPaid?.();
      router.refresh();
    } catch (err) {
      triggerHaptic("error");
      toast.error(err instanceof Error ? err.message : "Ödeme kaydedilemedi");
    } finally {
      setPayingId(null);
    }
  };

  if (payments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-emerald-500/25 bg-emerald-500/[0.04] p-6 text-center">
        <CheckCircle size={32} weight="duotone" className="mx-auto mb-2 text-emerald-400" />
        <p className="text-sm font-semibold text-zinc-200">Geciken ödemeniz yok</p>
        <p className="mt-1 text-[11px] text-zinc-500">
          Vadesi geçmiş ve ödenmemiş bir kalem bulunmuyor.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" role="list">
      {rows.map((p) => {
        const key = `${p.debtId}-${p.installmentId ?? p.dueDate}`;
        const days = Math.abs(p.daysUntilDue);
        const tone = severity(days);
        const isPaying = payingId === key;

        return (
          <li
            key={key}
            className={`rounded-2xl border p-3 transition-colors ${tone.ring}`}
          >
            <div className="flex items-start gap-3">
              <InstitutionLogo
                name={p.institutionName ?? p.title}
                color={p.institutionColor}
                type={p.institutionType ?? (p.institutionName ? "BANKA" : "KISI")}
                size={38}
                motifOnly
              />

              <div className="min-w-0 flex-1">
                <Link
                  href={`/debts/${p.debtId}`}
                  className="block truncate text-sm font-semibold text-zinc-100 hover:text-white"
                >
                  {p.title}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
                  <span>{KIND_LABELS[p.kind]}</span>
                  {p.institutionName && <span>· {p.institutionName}</span>}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px]">
                  <Clock size={12} className={tone.text} />
                  <span className="text-zinc-400">{formatDate(p.dueDate)}</span>
                  <span className={`font-semibold ${tone.text}`}>{days} gün gecikti</span>
                </p>
              </div>

              <div className="shrink-0 text-right">
                <span className="block font-mono text-sm font-bold tabular-nums text-zinc-50">
                  {formatCurrency(p.amountTL)}
                </span>
                {!compact && (
                  <button
                    type="button"
                    disabled={isPaying}
                    onClick={() => pay(p)}
                    className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-[11px] font-bold text-zinc-950 transition active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle size={14} weight="bold" />
                    {isPaying ? "Kaydediliyor" : "Ödendi"}
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}

      {limit && payments.length > limit && (
        <li>
          <Link
            href="/overdue"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] py-2.5 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-white/[0.07]"
          >
            <WarningOctagon size={14} weight="fill" />
            <span>{payments.length - limit} gecikmiş kalem daha</span>
            <ArrowRight size={13} />
          </Link>
        </li>
      )}
    </ul>
  );
}
