"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  House,
  CreditCard,
  Plus,
  ChartBar,
  WarningOctagon,
  CalendarBlank,
  List,
} from "@phosphor-icons/react";
import { haptics } from "@/lib/haptics";
import { useLiveData } from "@/components/live/LiveDataProvider";
import { MobileMenuSheet } from "./MobileMenuSheet";
import { QuickAddSheet } from "./QuickAddSheet";

interface NavLink {
  kind: "link";
  href: string;
  label: string;
  icon: typeof House;
  badge?: number;
}

/**
 * Telefonun alt gezinme çubuğu: yedi hücre, yeşil ekleme düğmesi tam ortada.
 *
 * Yedi tek sayı olduğu için ortası nettir - dördüncü hücre. Solda ve sağda
 * üçer bağlantı kalır; bu simetri düğmeyi başparmağın doğal yayına oturtur.
 *
 * Çubuk iOS home indicator'ının üstünde durur (safe-area) ve `md` altında
 * görünür; o genişlikte kenar çubuğu yok, dolayısıyla buraya girmeyen bir
 * sayfa telefonda erişilemez olur. Bu yüzden kalan sayfalar hamburger
 * menüsünde toplanır.
 */
export function MobileNav() {
  const pathname = usePathname();
  const live = useLiveData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [ekleOpen, setEkleOpen] = useState(false);
  const overdueCount = live?.data?.totals.overdueCount ?? 0;

  const solda: NavLink[] = [
    { kind: "link", href: "/", label: "Özet", icon: House },
    { kind: "link", href: "/debts", label: "Borçlar", icon: CreditCard },
    {
      kind: "link",
      href: "/overdue",
      label: "Geciken",
      icon: WarningOctagon,
      badge: overdueCount,
    },
  ];

  // Tema düğmesinin yeri: uygulama yalnız açık temada, yedi hücre korunuyor.
  const sagda: NavLink[] = [
    { kind: "link", href: "/reports", label: "Rapor", icon: ChartBar },
    { kind: "link", href: "/calendar", label: "Takvim", icon: CalendarBlank },
  ];

  const renderLink = (item: NavLink) => {
    const Icon = item.icon;
    const isActive =
      pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        onClick={() => haptics.selection()}
        className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors active:bg-white/5 ${
          isActive ? "text-white" : "text-zinc-500"
        }`}
      >
        <span className="relative">
          <Icon size={20} weight={isActive ? "fill" : "regular"} />
          {item.badge != null && item.badge > 0 && (
            <span
              aria-label={`${item.badge} gecikmiş ödeme`}
              className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
            >
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          )}
        </span>
        <span className="text-[8.5px] font-medium leading-none">{item.label}</span>
        {isActive && (
          <motion.span
            layoutId="mobil-sekme-cizgisi"
            className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-white"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
      </Link>
    );
  };

  return (
    <>
      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/95 backdrop-blur-2xl md:hidden">
        <nav
          aria-label="Ana gezinme"
          className="mx-auto flex h-[3.75rem] max-w-lg items-stretch justify-around gap-0.5 px-1"
        >
          {solda.map(renderLink)}

          {/*
            4/7: tam orta hücre.

            Doğrudan borç sihirbazına gidiyordu; oysa günlük olarak en sık
            eklenen şey harcama. Artık üçünü de sunan bir seçim açıyor.
          */}
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setEkleOpen(true);
            }}
            aria-label="Ekle"
            aria-expanded={ekleOpen}
            className={`relative -top-4 flex h-14 w-14 shrink-0 items-center justify-center self-start rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-zinc-950 shadow-[0_6px_20px_rgba(16,185,129,0.45)] transition-transform active:scale-90 ${
              ekleOpen ? "rotate-45" : ""
            }`}
          >
            <Plus size={26} weight="bold" />
          </button>

          {sagda.map(renderLink)}


          {/* 7/7: hamburger */}
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setMenuOpen(true);
            }}
            aria-label="Menüyü aç"
            aria-expanded={menuOpen}
            className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors active:bg-white/5 ${
              menuOpen ? "text-white" : "text-zinc-500"
            }`}
          >
            <List size={20} weight={menuOpen ? "bold" : "regular"} />
            <span className="text-[8.5px] font-medium leading-none">Menü</span>
          </button>
        </nav>
      </div>

      <QuickAddSheet open={ekleOpen} onClose={() => setEkleOpen(false)} />
      <MobileMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
