"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOut, ShieldCheck, User } from "@phosphor-icons/react";
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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-white/10 bg-background/85 px-4 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90 touch-feedback"
          onClick={() => haptics.selection()}
        >
          {/* Küçük harf yazı logosu: ikon kutusu ve rozet yerine sade bir işaret. */}
          <span className="text-[19px] font-medium tracking-[-0.03em] text-white">
            borçölçme<sup className="ml-0.5 text-[9px] font-normal text-zinc-500">®</sup>
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {userEmail ? (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-300">
              <User size={14} className="text-zinc-400" />
              <span>{userEmail}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-full bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors duration-200 ease-in-out hover:bg-white/10 hover:text-white touch-feedback"
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
