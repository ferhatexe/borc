"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { haptics } from "@/lib/haptics";
import type { AppPreferences } from "@/lib/settings/defaults";

/** Ayarlar > Hesap: kumarsız gün serisini aç/kapa, şifre değiştir. */
export function AccountSection({ preferences }: { preferences: AppPreferences }) {
  const router = useRouter();
  const [coach, setCoach] = useState(preferences.gamblingCoach !== false);
  const [savingCoach, setSavingCoach] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const toggleCoach = async (value: boolean) => {
    setCoach(value);
    setSavingCoach(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_preferences: { ...preferences, gamblingCoach: value } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kaydedilemedi");
      haptics.success();
      toast.success(value ? "Kumarsız gün serisi ana sayfada" : "Kumarsız gün serisi gizlendi");
      router.refresh();
    } catch (err) {
      setCoach(!value);
      haptics.error();
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSavingCoach(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPw(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Şifre değiştirilemedi");
      haptics.success();
      toast.success("Şifre değiştirildi");
      setCurrent("");
      setNext("");
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : "Şifre değiştirilemedi");
    } finally {
      setSavingPw(false);
    }
  };

  const field =
    "h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-white focus:border-emerald-500 focus:outline-none";

  return (
    <section className="glass-card p-4 sm:p-5 space-y-4">
      <header className="flex items-center gap-2">
        <UserCircle size={18} className="text-zinc-400" />
        <h2 className="text-sm font-semibold text-white">Hesap</h2>
      </header>

      <label className="flex items-start justify-between gap-4 rounded-xl border border-white/10 p-3.5">
        <span>
          <span className="block text-sm font-medium text-white">Kumarsız gün serisi</span>
          <span className="block text-[11px] text-zinc-500">
            Ana sayfada seri kartını, dürtü ekranını ve kumar kaybı kartını gösterir.
          </span>
        </span>
        <input
          type="checkbox"
          checked={coach}
          disabled={savingCoach}
          onChange={(e) => void toggleCoach(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-current"
        />
      </label>

      <form onSubmit={changePassword} className="space-y-2.5">
        <p className="text-sm font-medium text-white">Şifre değiştir</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Mevcut şifre"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={field}
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Yeni şifre (en az 8 karakter)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={field}
          />
        </div>
        <button
          type="submit"
          disabled={savingPw}
          className="h-10 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-zinc-950 active:scale-95 disabled:opacity-50"
        >
          {savingPw ? "Kaydediliyor..." : "Şifreyi değiştir"}
        </button>
      </form>
    </section>
  );
}
