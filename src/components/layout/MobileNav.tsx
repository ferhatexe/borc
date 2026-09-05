"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  CreditCard,
  Plus,
  TrendUp,
  Gear,
} from "@phosphor-icons/react";
import { haptics } from "@/lib/haptics";

export function MobileNav() {
  const pathname = usePathname();

  const items = [
    { href: "/", label: "Özet", icon: House },
    { href: "/debts", label: "Borçlar", icon: CreditCard },
    { href: "/debts/new", label: "Ekle", icon: Plus, isAction: true },
    { href: "/income", label: "Gelir/Gid", icon: TrendUp },
    { href: "/settings", label: "Ayarlar", icon: Gear },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 block border-t border-white/10 bg-[#0A0A0B]/90 backdrop-blur-2xl md:hidden pb-safe">
      <nav className="flex h-16 items-center justify-around px-2">
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
                onClick={() => haptics.tap()}
                className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-transform active:scale-90"
              >
                <Icon size={24} weight="bold" />
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => haptics.selection()}
              className={`flex flex-col items-center justify-center py-1 transition-colors touch-feedback ${
                isActive ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon size={22} weight={isActive ? "duotone" : "regular"} />
              <span className="mt-1 text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
