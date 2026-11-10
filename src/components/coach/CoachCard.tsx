"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Check, Fire, Phone, Wind, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { haptics } from "@/lib/haptics";
import { celebrate } from "@/lib/celebrate";
import { formatCurrency, toDateInputValue } from "@/lib/formatters";
import { NumberField } from "@/components/shared/NumberField";
import type { DayStatus, StreakView } from "@/lib/coach/streak";

const GUN_HARFI = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];
const gunHarfi = (date: string) =>
  GUN_HARFI[new Date(`${date}T12:00:00Z`).getUTCDay()];

async function post(body: Record<string, unknown>): Promise<StreakView> {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Kaydedilemedi");
  return json as StreakView;
}

/** Alttan açılan (masaüstünde ortalanan) pencere. */
function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="relative max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border border-white/10 bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:rounded-3xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">{label}</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 active:scale-95"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function CallButton() {
  return (
    <a
      href="tel:115"
      onClick={() => haptics.tap()}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 text-sm font-semibold text-white active:scale-[0.99]"
    >
      <Phone size={17} weight="fill" />
      115 Yeşilay Danışma Hattı&apos;nı ara
    </a>
  );
}

const DURTU_SURESI = 5 * 60;

/** Dürtü anı: nefes temposu, geri sayım ve arama düğmesi. */
function UrgeSheet({
  open,
  onClose,
  streakDays,
  dailyInterestTL,
  onPassed,
}: {
  open: boolean;
  onClose: () => void;
  streakDays: number;
  dailyInterestTL: number;
  onPassed: () => void;
}) {
  const [left, setLeft] = useState(DURTU_SURESI);
  const [inhale, setInhale] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLeft(DURTU_SURESI);
    setInhale(true);
    const tick = window.setInterval(
      () => setLeft((s) => Math.max(0, s - 1)),
      1000,
    );
    // 4 sn nefes al, 6 sn ver.
    let phaseTimer: number;
    const phase = (isInhale: boolean) => {
      setInhale(isInhale);
      phaseTimer = window.setTimeout(
        () => phase(!isInhale),
        isInhale ? 4000 : 6000,
      );
    };
    phase(true);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(phaseTimer);
    };
  }, [open]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <Sheet open={open} onClose={onClose} label="Dürtü geçer">
      <p className="text-sm text-zinc-400">
        Oynama isteği dalga gibidir: yükselir, birkaç dakika içinde söner. Şu an
        karar verme, sadece nefesi takip et.
      </p>

      <div className="my-6 flex flex-col items-center gap-4">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <motion.div
            animate={{ scale: inhale ? 1 : 0.62 }}
            transition={{ duration: inhale ? 4 : 6, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full border border-white/15 bg-white/5 motion-reduce:!transform-none"
          />
          <div className="relative text-center">
            <span className="block text-sm font-medium text-zinc-300">
              {inhale ? "Nefes al" : "Nefes ver"}
            </span>
            <span className="mt-1 block font-mono text-3xl font-bold tabular-nums text-white">
              {mm}:{ss}
            </span>
          </div>
        </div>
        {left === 0 && (
          <p className="text-center text-sm font-medium text-white">
            5 dakika geçti. İstek hâlâ aynı güçte mi?
          </p>
        )}
      </div>

      <ul className="mb-5 space-y-2 text-[13px] text-zinc-300">
        {streakDays > 0 && (
          <li className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <b className="text-white">{streakDays} gündür</b> oynamıyorsun. Bir
            oyun bu seriyi sıfırlar.
          </li>
        )}
        {dailyInterestTL > 0 && (
          <li className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            Borçlarına her gün{" "}
            <b className="text-white">{formatCurrency(dailyInterestTL)}</b> faiz
            işliyor; kaybedilen her lira bunun üstüne eklenir.
          </li>
        )}
        <li className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Kaybı geri kazanmak için oynamak, kaybı büyütmenin en yaygın yolu.
        </li>
      </ul>

      <div className="space-y-2">
        <button
          type="button"
          onClick={onPassed}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-bold text-zinc-950 active:scale-[0.99]"
        >
          <Check size={17} weight="bold" />
          Geçti, oynamadım
        </button>
        <CallButton />
      </div>
    </Sheet>
  );
}

/** Oynanan bir günü bildirme (ilk kurulum da bu pencere). */
function GambleSheet({
  open,
  onClose,
  isSetup,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  isSetup: boolean;
  onSaved: (view: StreakView) => void;
}) {
  const today = toDateInputValue();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(toDateInputValue());
      setAmount("");
      setDone(false);
    }
  }, [open]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const view = await post({
        action: "gamble",
        date,
        amountTL: amount ? Number(amount) : null,
      });
      haptics.success();
      onSaved(view);
      setDone(true);
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={isSetup ? "Seriyi başlat" : "Oynadığın günü bildir"}
    >
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            {isSetup
              ? "Seri kuruldu. Her gün bir kez işaretlemen yeterli."
              : "Bunu yazman kolay değildi ve doğru olanı yaptın. Seri bugünden yeniden başlıyor; en iyi serin kayıtlı kalıyor."}
          </p>
          {!isSetup && (
            <p className="text-sm text-zinc-400">
              Şu an en riskli an, kaybı geri almak için tekrar oynamak. Biriyle
              konuşmak işe yarar; Yeşilay&apos;ın hattı ücretsiz ve gizli.
            </p>
          )}
          {!isSetup && <CallButton />}
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-2xl bg-emerald-500 text-sm font-bold text-zinc-950 active:scale-[0.99]"
          >
            Tamam
          </button>
        </div>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <p className="text-sm text-zinc-400">
            {isSetup
              ? "En son hangi gün oynadın? Seri o günden itibaren sayılır."
              : "Seri bu günden yeniden başlar. Dürüst kayıt, serinin kendisinden daha değerli."}
          </p>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-300">
              {isSetup ? "Son oynadığın gün" : "Oynadığın gün"}
            </span>
            <input
              type="date"
              required
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-300">
              Kaybedilen tutar (isteğe bağlı)
            </span>
            <div className="relative">
              <NumberField
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-900 pl-3.5 pr-10 font-mono text-base text-white focus:border-emerald-500 focus:outline-none"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                ₺
              </span>
            </div>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="h-12 w-full rounded-2xl bg-emerald-500 text-sm font-bold text-zinc-950 active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : isSetup ? "Seriyi başlat" : "Kaydet"}
          </button>
        </form>
      )}
    </Sheet>
  );
}

const DOT_STYLE: Record<DayStatus, string> = {
  clean: "border-emerald-500 bg-emerald-500 text-zinc-950",
  relapse: "border-rose-500/50 bg-rose-500/15 text-rose-400",
  pending: "border-dashed border-white/40 text-zinc-400",
  none: "border-white/10 text-zinc-500",
};

/**
 * Kumarsız gün serisi.
 *
 * Seri son oynanan günden sayılır; günlük işaret seriyi büyütmez, sadece o
 * günü haftalık satırda yeşile çevirir ve küçük bir ödül (titreşim, konfeti)
 * verir. Unutulan gün seriyi bozmaz.
 */
export function CoachCard({
  initial,
  dailyInterestTL,
}: {
  initial: StreakView;
  dailyInterestTL: number;
}) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [urgeOpen, setUrgeOpen] = useState(false);
  const [gambleOpen, setGambleOpen] = useState(false);
  // Pencere açılırken kurulum mu bildirim mi olduğu sabitlenir: kaydedince kart
  // "kurulu" görünüme geçer ama açık pencere aynı kalmalı (yoksa "seri kuruldu"
  // mesajı yerine boş bir bildirim formu açılıyordu).
  const [sheetIsSetup, setSheetIsSetup] = useState(false);
  const openGamble = (isSetup: boolean) => {
    setSheetIsSetup(isSetup);
    setGambleOpen(true);
  };
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setView(initial), [initial]);

  const doCheckIn = async (burstFrom?: HTMLElement | null) => {
    if (busy || view.checkedInToday) return;
    setBusy(true);
    try {
      const next = await post({ action: "checkin" });
      setView(next);
      const rect = burstFrom?.getBoundingClientRect();
      celebrate(
        rect ? { x: rect.left + rect.width / 2, y: rect.top } : undefined,
      );
      router.refresh();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  // İki görünümde de ağacın aynı yerinde duran tek pencere.
  const gambleSheet = (
    <GambleSheet
      open={gambleOpen}
      onClose={() => setGambleOpen(false)}
      isSetup={sheetIsSetup}
      onSaved={(v) => {
        setView(v);
        router.refresh();
      }}
    />
  );

  if (!view.isSetUp) {
    return (
      <>
        <section
          aria-label="Kumarsız gün serisi"
          className="glass-card p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-300">
                <Fire size={22} weight="duotone" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white">
                  Kumarsız gün serisi
                </h2>
                <p className="text-xs text-zinc-400">
                  Oynamadığın her günü say; dürtü geldiğinde tek dokunuşla
                  destek aç.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                openGamble(true);
              }}
              className="h-11 rounded-2xl bg-emerald-500 px-5 text-sm font-bold text-zinc-950 active:scale-95"
            >
              Seriyi başlat
            </button>
          </div>
        </section>
        {gambleSheet}
      </>
    );
  }

  const progress =
    view.nextMilestone > 0
      ? Math.min(100, Math.round((view.days / view.nextMilestone) * 100))
      : 0;

  return (
    <>
      <section
        aria-label="Kumarsız gün serisi"
        className="glass-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex items-center gap-3.5">
            <motion.span
              key={view.days}
              initial={{ scale: 0.7, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 16 }}
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                view.days > 0
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-white/5 text-zinc-400"
              }`}
            >
              <Fire size={30} weight="fill" />
            </motion.span>
            <div>
              <div className="flex items-baseline gap-1.5">
                <motion.span
                  key={view.days}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="font-mono text-4xl font-bold leading-none tabular-nums text-white"
                >
                  {view.days}
                </motion.span>
                <span className="text-sm font-medium text-zinc-300">
                  gündür kumar yok
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                En iyi seri: {view.bestStreak} gün
                {view.totalLostTL > 0 &&
                  ` · bildirilen kayıp: ${formatCurrency(view.totalLostTL)}`}
              </p>
            </div>
          </div>

          {/* Haftalık satır */}
          <ol className="flex items-center gap-1.5" aria-label="Son 7 gün">
            {view.week.map((d) => (
              <li key={d.date} className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-bold ${DOT_STYLE[d.status]}`}
                  title={d.date}
                >
                  {d.status === "clean" ? (
                    <Check size={14} weight="bold" />
                  ) : d.status === "relapse" ? (
                    <X size={12} weight="bold" />
                  ) : (
                    ""
                  )}
                </span>
                <span className="text-[9px] font-medium text-zinc-500">
                  {gunHarfi(d.date)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Sıradaki hedef */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-zinc-400">
            <span>
              Sıradaki hedef:{" "}
              <b className="text-white">{view.nextMilestone}. gün</b>
            </span>
            <span>{view.daysToMilestone} gün kaldı</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full bg-amber-400"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
          <button
            ref={buttonRef}
            type="button"
            disabled={busy || view.checkedInToday || view.days === 0}
            onClick={() => void doCheckIn(buttonRef.current)}
            className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-transform active:scale-[0.98] ${
              view.checkedInToday
                ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : view.days === 0
                  ? "border border-white/10 bg-white/5 text-zinc-400"
                  : "bg-emerald-500 text-zinc-950"
            }`}
          >
            <Check size={17} weight="bold" />
            {view.checkedInToday
              ? "Bugün işaretlendi"
              : view.days === 0
                ? "Seri yarın 1. güne geçer"
                : "Bugün oynamadım"}
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setUrgeOpen(true);
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white active:scale-[0.98]"
          >
            <Wind size={17} weight="bold" />
            Dürtü geldi
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              openGamble(false);
            }}
            className="h-12 rounded-2xl px-4 text-sm font-medium text-zinc-400 hover:text-white active:scale-[0.98]"
          >
            Oynadım
          </button>
        </div>

        <UrgeSheet
          open={urgeOpen}
          onClose={() => setUrgeOpen(false)}
          streakDays={view.days}
          dailyInterestTL={dailyInterestTL}
          onPassed={() => {
            setUrgeOpen(false);
            if (view.checkedInToday) celebrate();
            else void doCheckIn(null);
          }}
        />
      </section>
      {gambleSheet}
    </>
  );
}
