"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { TrendDown, TrendUp, CreditCard, X } from "@phosphor-icons/react";
import { haptics } from "@/lib/haptics";

/**
 * Alt çubuktaki yeşil düğmenin açtığı hızlı ekleme sayfası.
 *
 * Düğme doğrudan borç ekleme sihirbazına gidiyordu. Oysa günlük olarak en sık
 * eklenen şey harcama; onun için Giderler sayfasına gidip oradaki düğmeyi
 * bulmak gerekiyordu. Borç ise ayda bir eklenen bir şey. Üç seçenek de bir
 * dokunuş uzakta olsun diye araya bu seçim geldi ve harcama başa alındı.
 *
 * Gelir ve gider bağlantıları `?ekle=1` taşır; sayfa açılır açılmaz formu açar.
 */
const SECENEKLER = [
  {
    href: "/expenses?ekle=1",
    label: "Harcama Ekle",
    desc: "Market, fatura, akaryakıt",
    icon: TrendDown,
    renk: "text-rose-400",
    zemin: "bg-rose-500/10 border-rose-500/25",
  },
  {
    href: "/income?ekle=1",
    label: "Gelir Ekle",
    desc: "Maaş, kira, ek gelir",
    icon: TrendUp,
    renk: "text-emerald-400",
    zemin: "bg-emerald-500/10 border-emerald-500/25",
  },
  {
    href: "/debts/new",
    label: "Borç Ekle",
    desc: "Kredi, kart, altın borcu",
    icon: CreditCard,
    renk: "text-cyan-400",
    zemin: "bg-cyan-500/10 border-cyan-500/25",
  },
];

export function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Ne eklemek istiyorsunuz?"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-background pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:hidden"
          >
            <div className="flex flex-col items-center gap-3 pt-2.5 pb-3">
              <span className="h-1 w-10 rounded-full bg-white/20" />
              <div className="flex w-full items-center justify-between px-5">
                <span className="text-sm font-bold text-white">Ne eklemek istiyorsunuz?</span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Kapat"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 active:scale-95"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
            </div>

            <div className="space-y-2 px-4">
              {SECENEKLER.map((secenek, index) => {
                const Icon = secenek.icon;
                return (
                  <motion.div
                    key={secenek.href}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 + index * 0.05, duration: 0.22 }}
                  >
                    <Link
                      href={secenek.href}
                      onClick={() => {
                        haptics.selection();
                        onClose();
                      }}
                      className={`flex items-center gap-3.5 rounded-2xl border p-4 transition-transform active:scale-[0.99] ${secenek.zemin}`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 ${secenek.renk}`}
                      >
                        <Icon size={22} weight="duotone" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-white">
                          {secenek.label}
                        </span>
                        <span className="block text-[11px] text-zinc-500">{secenek.desc}</span>
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
