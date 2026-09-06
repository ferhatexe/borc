"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CaretDown,
  Lightning,
  WarningOctagon,
  ArrowSquareOut,
  Bank,
} from "@phosphor-icons/react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { InstitutionLogo } from "@/components/shared/InstitutionLogo";
import type { InstitutionBreakdown } from "@/lib/finance/debtValuation";

const TUR_ETIKETLERI: Record<string, { label: string; color: string }> = {
  TAKSITLI_KREDI: { label: "Taksitli Kredi", color: "#10b981" },
  KREDI_KARTI: { label: "Kredi Kartı", color: "#6366f1" },
  EK_HESAP_KMH: { label: "KMH / Ek Hesap", color: "#f59e0b" },
  ALTIN_BORCU: { label: "Altın Borcu", color: "#eab308" },
  KISI_BORCU: { label: "Kişi Borcu", color: "#ec4899" },
  SENET_CEK: { label: "Senet / Çek", color: "#8b5cf6" },
  DUZENLI_ODEME: { label: "Düzenli Ödeme", color: "#14b8a6" },
  DIGER: { label: "Diğer", color: "#71717a" },
};

function tarih(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Bir borcun tek satırdaki tam dökümü. */
function BorcSatiri({ debt }: { debt: InstitutionBreakdown["debts"][number] }) {
  const tur = TUR_ETIKETLERI[debt.type] ?? { label: debt.type, color: "#71717a" };

  return (
    <Link
      href={`/debts/${debt.id}`}
      className="group block rounded-2xl border border-white/10 bg-white/5 p-3.5 transition-colors hover:border-white/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: tur.color }}
            />
            <span className="truncate text-sm font-semibold text-white">{debt.title}</span>
            <ArrowSquareOut
              size={12}
              className="shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </div>
          <p className="mt-0.5 pl-4 text-[11px] text-zinc-500">
            {tur.label}
            {debt.currency !== "TRY" && ` · ${debt.currency}`}
            {debt.monthlyInterestRatePercent
              ? ` · aylık %${formatNumber(debt.monthlyInterestRatePercent, 2)}`
              : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-bold text-white tabular-nums">
            {formatCurrency(debt.outstandingTL)}
          </p>
          {debt.dailyAccrualTL > 0 && (
            <p className="mt-0.5 flex items-center justify-end gap-1 font-mono text-[10px] text-amber-400 tabular-nums">
              <Lightning size={9} weight="fill" />+{formatNumber(debt.dailyAccrualTL, 2)} ₺/gün
            </p>
          )}
        </div>
      </div>

      {/* Kırılım: rakamın neyden oluştuğu */}
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/5 pt-3 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-zinc-500">Anapara</dt>
          <dd className="font-mono text-zinc-200 tabular-nums">
            {formatCurrency(debt.principalTL)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">İşleyen faiz</dt>
          <dd
            className={`font-mono tabular-nums ${
              debt.accruedInterestTL > 0 ? "text-amber-400" : "text-zinc-500"
            }`}
          >
            {debt.accruedInterestTL > 0 ? formatCurrency(debt.accruedInterestTL) : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Bu ay ödenecek</dt>
          <dd className="font-mono text-zinc-200 tabular-nums">
            {debt.dueThisMonthTL > 0 ? formatCurrency(debt.dueThisMonthTL) : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Sonraki vade</dt>
          <dd
            className={`font-mono tabular-nums ${
              debt.isOverdue ? "font-bold text-rose-400" : "text-zinc-200"
            }`}
          >
            {debt.isOverdue && <WarningOctagon size={10} weight="fill" className="mr-0.5 inline" />}
            {tarih(debt.nextDueDate)}
          </dd>
        </div>
      </dl>

      {debt.totalInstallments ? (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${
                  (((debt.totalInstallments ?? 0) - (debt.remainingInstallments ?? 0)) /
                    (debt.totalInstallments || 1)) *
                  100
                }%`,
              }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] text-zinc-500">
            {(debt.totalInstallments ?? 0) - (debt.remainingInstallments ?? 0)}/
            {debt.totalInstallments} taksit
          </span>
        </div>
      ) : null}
    </Link>
  );
}

/**
 * Her borcun anlık dökümü, kuruma göre gruplanmış.
 *
 * Rapordaki kurum tablosu yalnızca "kaç adet borç, ne kadar" diyordu; bir
 * rakamın neden o kadar olduğunu görmek için borç sayfalarını tek tek gezmek
 * gerekiyordu. Burada her borç anapara, işleyen faiz, bu ayki taksit ve vade
 * olarak açılıyor, ve rakamlar sunucunun az önceki değerlemesinden geliyor -
 * yani altın ve kur dahil o anki hâlleriyle.
 *
 * Kurumlar tutara göre sıralı ve varsayılan olarak açık; borcu az olan bir
 * kasada her şeyi tek bakışta görmek, tıklayarak açmaktan iyidir.
 */
export function LiveDebtBreakdown({
  institutions,
  totalDebtTL,
  totalDailyAccrualTL,
  updatedAt,
}: {
  institutions: InstitutionBreakdown[];
  totalDebtTL: number;
  totalDailyAccrualTL: number;
  updatedAt: Date | null;
}) {
  const [kapali, setKapali] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setKapali((onceki) => {
      const yeni = new Set(onceki);
      if (yeni.has(id)) yeni.delete(id);
      else yeni.add(id);
      return yeni;
    });

  if (institutions.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Bank size={32} className="mx-auto mb-3 text-zinc-600" />
        <p className="text-xs text-zinc-500">Henüz kayıtlı borç bulunmuyor.</p>
      </div>
    );
  }

  const toplamBorcAdedi = institutions.reduce((s, i) => s + i.debtCount, 0);

  return (
    <div className="glass-card space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
            <Bank size={20} weight="duotone" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Anlık Borç Kırılımı</h3>
            <p className="text-xs text-zinc-400">
              {toplamBorcAdedi} borç · {institutions.length} kurum
              {updatedAt &&
                ` · ${updatedAt.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })} itibarıyla`}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="font-mono text-lg font-extrabold text-white tabular-nums">
            {formatCurrency(totalDebtTL)}
          </p>
          {totalDailyAccrualTL > 0 && (
            <p className="flex items-center justify-end gap-1 font-mono text-[10px] text-amber-400 tabular-nums">
              <Lightning size={10} weight="fill" />
              günde +{formatNumber(totalDailyAccrualTL, 2)} ₺
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {institutions.map((inst) => {
          const acik = !kapali.has(inst.institutionId);
          const pay = totalDebtTL > 0 ? (inst.totalOutstandingTL / totalDebtTL) * 100 : 0;

          return (
            <div key={inst.institutionId} className="space-y-2.5">
              <button
                type="button"
                onClick={() => toggle(inst.institutionId)}
                aria-expanded={acik}
                className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-white/5"
              >
                <InstitutionLogo
                  name={inst.institutionName}
                  color={inst.color}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-white">
                      {inst.institutionName}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-bold text-white tabular-nums">
                      {formatCurrency(inst.totalOutstandingTL)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pay}%`, backgroundColor: inst.color }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                      %{pay.toFixed(1)} · {inst.debtCount} borç
                    </span>
                  </div>
                </div>
                <CaretDown
                  size={14}
                  className={`shrink-0 text-zinc-500 transition-transform ${
                    acik ? "rotate-180" : ""
                  }`}
                />
              </button>

              {acik && (
                <div className="space-y-2 pl-1">
                  {inst.debts.map((debt) => (
                    <BorcSatiri key={debt.id} debt={debt} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
