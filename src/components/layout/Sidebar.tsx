"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  CreditCard,
  TrendUp,
  TrendDown,
  CalendarBlank,
  ChartBar,
  Gear,
  PlusCircle,
} from "@phosphor-icons/react";
import { haptics } from "@/lib/haptics";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: House },
  { href: "/debts", label: "Borçlar", icon: CreditCard },
  { href: "/income", label: "Gelirler", icon: TrendUp },
  { href: "/expenses", label: "Giderler", icon: TrendDown },
  { href: "/calendar", label: "Takvim", icon: CalendarBlank },
  { href: "/reports", label: "Raporlar", icon: ChartBar },
  { href: "/settings", label: "Ayarlar", icon: Gear },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-white/10 bg-[#0A0A0B]/60 p-4 backdrop-blur-xl">
      <div className="mb-4">
        <Link
          href="/debts/new"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all hover:brightness-110 touch-feedback"
          onClick={() => haptics.tap()}
        >
          <PlusCircle size={20} weight="bold" />
          <span>Yeni Borç Ekle</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => haptics.selection()}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors touch-feedback ${
                isActive
                  ? "bg-white/10 text-emerald-400 border border-white/10 shadow-sm"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              <Icon
                size={20}
                weight={isActive ? "duotone" : "regular"}
                className={isActive ? "text-emerald-400" : "text-zinc-400"}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-zinc-500">
        <div className="font-semibold text-zinc-400 mb-1">Borç & Nakit Takip</div>
        <div>Tüm hesaplamalar kuruş hassasiyetinde Decimal ile tutulur.</div>
      </div>
    </aside>
  );
}
