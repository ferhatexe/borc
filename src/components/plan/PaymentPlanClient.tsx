"use client";

import { useEffect, useMemo, useState } from "react";
import { CaretDown, CheckCircle, LockOpen, WarningCircle } from "@phosphor-icons/react";
import { NumberField } from "@/components/shared/NumberField";
import { formatCurrency } from "@/lib/formatters";
import {
  coverPayments,
  nearReliefTL,
  sortPayoffOptions,
  type PayoffOption,
  type PayoffSort,
  type PlanPayment,
} from "@/lib/finance/paymentPlan";

interface Props {
  payments: PlanPayment[];
  options: PayoffOption[];
  monthKeys: string[];
}

const STORE_KEY = "odeme-plani";

const SORTS: Array<{ id: PayoffSort; label: string }> = [
  { id: "yuk", label: "Aylık yük" },
  { id: "faiz", label: "Faiz" },
  { id: "vade", label: "Vade" },
];

const monthName = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 15).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
};
const shortMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 15).toLocaleDateString("tr-TR", { month: "short" });
};
const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Istanbul" });
const tl = (n: number) => formatCurrency(n).replace(/,00 ₺$/, " ₺");

export function PaymentPlanClient({ payments, options, monthKeys }: Props) {
  const [cash, setCash] = useState<number | null>(null);
  const [income, setIncome] = useState<number | null>(null);
  const [sort, setSort] = useState<PayoffSort>("yuk");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Girilen rakamlar yalnız bu tarayıcıda hatırlanır (kolaylık; kayıt değil).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { cash?: number | null; income?: number | null; sort?: PayoffSort };
      if (typeof saved.cash === "number") setCash(saved.cash);
      if (typeof saved.income === "number") setIncome(saved.income);
      if (saved.sort && SORTS.some((s) => s.id === saved.sort)) setSort(saved.sort);
    } catch {
      /* depolama kapalı olabilir */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ cash, income, sort }));
    } catch {
      /* yok say */
    }
  }, [cash, income, sort]);

  const payoffTotal = useMemo(
    () => options.filter((o) => selected.has(o.debtId)).reduce((s, o) => s + o.payoffTL, 0),
    [options, selected]
  );
  const cashLeft = (cash ?? 0) - payoffTotal;
  const months = useMemo(
    () => coverPayments(payments, Math.max(0, cashLeft), selected),
    [payments, cashLeft, selected]
  );
  const sorted = useMemo(() => sortPayoffOptions(options, sort, monthKeys), [options, sort, monthKeys]);

  const firstShort = months.flatMap((m) => m.payments).find((p) => p.shortTL > 0);
  const lastCovered = months
    .flatMap((m) => m.payments)
    .filter((p) => p.shortTL === 0)
    .at(-1);
  const hasCash = cash !== null && cash > 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedRelief = monthKeys.map((m) =>
    options.filter((o) => selected.has(o.debtId)).reduce((s, o) => s + (o.reliefByMonth[m] ?? 0), 0)
  );

  return (
    <div className="space-y-5">
      {/* Girdiler */}
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block rounded-2xl border border-white/10 bg-white/5 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Eldeki para</span>
          <NumberField
            value={cash}
            onChange={(e) => setCash(e.target.value === "" ? null : Number(e.target.value))}
            placeholder="0"
            className="mt-1 w-full bg-transparent font-mono text-lg font-bold tabular-nums text-white outline-none placeholder:text-zinc-600"
          />
        </label>
        <label className="block rounded-2xl border border-white/10 bg-white/5 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Aylık gelir</span>
          <NumberField
            value={income}
            onChange={(e) => setIncome(e.target.value === "" ? null : Number(e.target.value))}
            placeholder="isteğe bağlı"
            className="mt-1 w-full bg-transparent font-mono text-lg font-bold tabular-nums text-white outline-none placeholder:text-sm placeholder:font-normal placeholder:text-zinc-600"
          />
        </label>
      </div>

      {/* Özet */}
      {hasCash && (
        <div
          className={`rounded-2xl border p-3.5 text-sm ${
            firstShort
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {payoffTotal > (cash ?? 0) ? (
            <p className="flex items-start gap-2">
              <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
              Seçilen kapamalar eldeki parayı {tl(payoffTotal - (cash ?? 0))} aşıyor.
            </p>
          ) : firstShort ? (
            <p className="flex items-start gap-2">
              <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
              <span>
                {lastCovered ? <>Para <b>{dayMonth(lastCovered.dueDate)}</b> ödemesine kadar yetiyor. </> : null}
                <b>{dayMonth(firstShort.dueDate)}</b> {firstShort.title} için{" "}
                <b className="font-mono tabular-nums">{tl(firstShort.shortTL)}</b> eksik.
              </span>
            </p>
          ) : (
            <p className="flex items-center gap-2">
              <CheckCircle size={18} weight="fill" className="shrink-0" />
              Listedeki ödemelerin hepsi karşılanıyor; {tl(months.at(-1)?.payments.at(-1)?.cashAfterTL ?? cashLeft)} artıyor.
            </p>
          )}
        </div>
      )}

      {/* Aylar */}
      <section className="space-y-2">
        <h2 className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Aylara göre ödemeler</h2>
        {months.length === 0 && <p className="px-0.5 text-sm text-zinc-400">Önümüzdeki aylarda ödeme yok.</p>}
        {months.map((m, i) => {
          const net = income !== null ? income - m.totalTL : null;
          return (
            <details key={m.month} open={i === 0} className="group rounded-2xl border border-white/10 bg-white/5">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold capitalize text-white">{monthName(m.month)}</p>
                  <p className="text-[11px] text-zinc-400">
                    {m.payments.length} ödeme
                    {net !== null && (
                      <span className={net < 0 ? "text-rose-300" : "text-emerald-300"}>
                        {" "}· gelirden sonra {net < 0 ? "−" : "+"}
                        {tl(Math.abs(net))}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold tabular-nums text-white">{tl(m.totalTL)}</p>
                  {hasCash && m.shortTL > 0 && (
                    <p className="font-mono text-[11px] tabular-nums text-rose-300">eksik {tl(m.shortTL)}</p>
                  )}
                </div>
                <CaretDown size={14} className="shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="divide-y divide-white/5 border-t border-white/10">
                {m.payments.map((p) => (
                  <li key={p.key} className="flex items-center gap-2.5 px-3.5 py-2 text-[13px]">
                    <span className={`w-10 shrink-0 font-mono tabular-nums ${p.isOverdue ? "text-rose-300" : "text-zinc-400"}`}>
                      {dayMonth(p.dueDate)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-zinc-200">{p.title}</span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono tabular-nums text-white">{tl(p.amountTL)}</span>
                      {hasCash &&
                        (p.shortTL > 0 ? (
                          <span className="block font-mono text-[10px] tabular-nums text-rose-300">−{tl(p.shortTL)}</span>
                        ) : (
                          <span className="block font-mono text-[10px] tabular-nums text-zinc-500">kalan {tl(p.cashAfterTL)}</span>
                        ))}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </section>

      {/* Peşin kapama */}
      {options.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Peşin kapatırsam</h2>
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-[11px]" role="group" aria-label="Sıralama">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSort(s.id)}
                  aria-pressed={sort === s.id}
                  className={`rounded-md px-2 py-1 font-semibold transition-colors ${
                    sort === s.id ? "bg-white/10 text-white" : "text-zinc-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-1.5">
            {sorted.map((o) => {
              const on = selected.has(o.debtId);
              const near = nearReliefTL(o, monthKeys);
              return (
                <li key={o.debtId}>
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 transition-colors ${
                      on ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(o.debtId)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[13px] font-semibold text-white">{o.title}</p>
                        <p className="shrink-0 font-mono text-[13px] font-bold tabular-nums text-white">{tl(o.payoffTL)}</p>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                        {near > 0 && <>{monthKeys.length} ayda −{tl(near)} taksit · </>}
                        {o.monthlyInterestTL !== null
                          ? <>ayda ~{tl(o.monthlyInterestTL)} faiz işliyor</>
                          : o.interestSavedTL > 0
                            ? <>{tl(o.interestSavedTL)} faiz ödenmez</>
                            : <>faiz farkı yok</>}
                      </p>
                      {o.reopensLimit && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                          <LockOpen size={11} weight="bold" />
                          Kapanınca limit yeniden açılır
                        </p>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          {selected.size > 0 && (
            <div className="sticky bottom-24 z-10 rounded-2xl border border-emerald-500/40 bg-zinc-900 p-3 text-[12px] shadow-lg lg:bottom-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-zinc-400">{selected.size} borç kapanırsa</span>
                <span className="font-mono font-bold tabular-nums text-white">{tl(payoffTotal)}</span>
              </div>
              {hasCash && (
                <p className={`mt-0.5 text-right font-mono tabular-nums ${cashLeft < 0 ? "text-rose-300" : "text-zinc-300"}`}>
                  elde {cashLeft < 0 ? "−" : ""}{tl(Math.abs(cashLeft))} kalır
                </p>
              )}
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-400">
                {monthKeys.map((m, i) =>
                  selectedRelief[i] > 0 ? (
                    <span key={m}>
                      <span className="capitalize">{shortMonth(m)}</span>{" "}
                      <span className="font-mono tabular-nums text-emerald-300">−{tl(selectedRelief[i])}</span>
                    </span>
                  ) : null
                )}
              </p>
            </div>
          )}

          <p className="px-0.5 text-[11px] leading-relaxed text-zinc-500">
            Kapama tutarları uygulamanın hesabıdır; ödemeden önce kesin rakamı bankadan alın. İhtiyaç
            kredilerinde erken kapamada küçük bir tazminat (yaklaşık %0,5–1) çıkabilir. Sıralama yalnızca
            seçtiğin ölçütü gösterir, öneri değildir.
          </p>
        </section>
      )}
    </div>
  );
}
