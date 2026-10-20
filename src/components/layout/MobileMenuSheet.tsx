"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  TrendUp,
  TrendDown,
  CalendarBlank,
  Gear,
  SignOut,
  X,
  Coins,
} from "@phosphor-icons/react";
import { haptics } from "@/lib/haptics";

/** Alt çubuğa sığmayan, ama telefonda erişilebilir kalması gereken sayfalar. */
const MENU_ITEMS = [
  { href: "/income", label: "Gelirler", desc: "Maaş, kira, ek gelir", icon: TrendUp },
  { href: "/expenses", label: "Giderler", desc: "Harcama kayıtları", icon: TrendDown },
  { href: "/calendar", label: "Takvim", desc: "Ödeme günleri", icon: CalendarBlank },
  { href: "/settings", label: "Ayarlar", desc: "Marjlar, vergiler", icon: Gear },
];

/**
 * Hamburger menüsü: alttan yükselen bir sayfa.
 *
 * Alt çubukta yalnızca yedi hücre var; geri kalan sayfalar buraya toplanır.
 * Panel alttan açılır çünkü telefonu tek elle tutan başparmak oraya ulaşır -
 * üstten açılan bir menü aynı listeyi erişilmez kılardı.
 *
 * Açıkken arkadaki sayfanın kaydırılması durdurulur, Esc kapatır ve odak
 * panelin içine alınır.
 */
export function MobileMenuSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Yol değişince panel kendiliğinden kapanır.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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

  const handleLogout = async () => {
    haptics.tap();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Menüyü kapat"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Menü"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-background pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:hidden"
          >
            {/* Sürükleme tutamağı: panelin aşağı kapanabileceğini anlatır. */}
            <div className="sticky top-0 z-10 flex flex-col items-center gap-3 bg-background pt-2.5 pb-3">
              <span className="h-1 w-10 rounded-full bg-white/20" />
              <div className="flex w-full items-center justify-between px-5">
                <div className="flex items-center gap-2">
                  <Coins size={20} weight="duotone" className="text-emerald-400" />
                  <span className="text-sm font-bold text-white">Menü</span>
                </div>
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

            <nav className="space-y-1.5 px-4">
              {MENU_ITEMS.map((item, index) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + index * 0.045, duration: 0.25 }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => haptics.selection()}
                      className={`flex items-center gap-3.5 rounded-2xl border p-3.5 transition-colors active:scale-[0.99] ${
                        isActive
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isActive
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-white/5 text-zinc-400"
                        }`}
                      >
                        <Icon size={20} weight="duotone" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-white">
                          {item.label}
                        </span>
                        <span className="block text-[11px] text-zinc-500">{item.desc}</span>
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="mt-4 px-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 py-3 text-xs font-semibold text-rose-400 active:scale-[0.99]"
              >
                <SignOut size={16} weight="bold" />
                Güvenli Çıkış
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
