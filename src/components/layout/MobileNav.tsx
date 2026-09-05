"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  CreditCard,
  Plus,
  ArrowsLeftRight,
  WarningOctagon,
} from "@phosphor-icons/react";
import { haptics } from "@/lib/haptics";
import { useLiveData } from "@/components/live/LiveDataProvider";

/**
 * Bottom navigation for phones.
 *
 * Every target is at least 56x44 px so it is comfortably reachable one-handed,
 * and the bar sits above the iOS home indicator via the safe-area inset. The
 * overdue tab carries a live count badge fed by the shared live poll.
 */
export function MobileNav() {
  const pathname = usePathname();
  const live = useLiveData();
  const overdueCount = live?.data?.totals.overdueCount ?? 0;

  const items = [
    { href: "/", label: "Özet", icon: House },
    { href: "/debts", label: "Borçlar", icon: CreditCard },
    { href: "/debts/new", label: "Ekle", icon: Plus, isAction: true },
    {
      href: "/overdue",
      label: "Geciken",
      icon: WarningOctagon,
      badge: overdueCount,
    },
    { href: "/income", label: "Gelir/Gider", icon: ArrowsLeftRight },
  ];

  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0A0A0B]/95 backdrop-blur-2xl md:hidden">
      <nav aria-label="Ana gezinme" className="mx-auto flex h-[3.75rem] max-w-lg items-stretch justify-around px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && !item.isAction && pathname.startsWith(item.href));

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label="Yeni borç ekle"
                onClick={() => haptics.tap()}
                className="relative -top-4 flex h-14 w-14 shrink-0 items-center justify-center self-start rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-zinc-950 shadow-[0_6px_20px_rgba(16,185,129,0.45)] transition-transform active:scale-90"
              >
                <Icon size={26} weight="bold" />
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => haptics.selection()}
              className={`relative flex min-w-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors active:bg-white/5 ${
                isActive ? "text-emerald-400" : "text-zinc-500"
              }`}
            >
              <span className="relative">
                <Icon size={22} weight={isActive ? "fill" : "regular"} />
                {item.badge != null && item.badge > 0 && (
                  <span
                    aria-label={`${item.badge} gecikmiş ödeme`}
                    className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
                  >
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </span>
              <span className="text-[9.5px] font-medium leading-none">{item.label}</span>
              {isActive && (
                <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-emerald-400" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
