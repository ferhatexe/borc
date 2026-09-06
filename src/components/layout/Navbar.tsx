"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, SignOut, ShieldCheck, User } from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { haptics } from "@/lib/haptics";

interface NavbarProps {
  userEmail?: string | null;
}

export function Navbar({ userEmail }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    haptics.tap();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      haptics.success();
      router.push("/login");
      router.refresh();
    } catch {
      haptics.error();
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-white/10 bg-background/80 px-4 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90 touch-feedback"
          onClick={() => haptics.selection()}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Coins size={22} weight="duotone" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              BORÇÖLÇME
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                PRO
              </span>
            </span>
            <span className="hidden text-[11px] text-zinc-400 sm:block">
              Kişisel Borç & Finans Takip
            </span>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        {userEmail ? (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              <User size={14} className="text-emerald-400" />
              <span>{userEmail}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 touch-feedback"
              title="Güvenli Çıkış Yap"
            >
              <SignOut size={16} />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 touch-feedback"
            onClick={() => haptics.tap()}
          >
            <ShieldCheck size={16} weight="bold" />
            <span>Giriş Yap</span>
          </Link>
        )}
      </div>
    </header>
  );
}
