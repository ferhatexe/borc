"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, SpinnerGap } from "@phosphor-icons/react";
import { haptics } from "@/lib/haptics";

const MIN = 8;

/** Kurulum bağlantısıyla ilk şifreyi belirleme formu. */
export function SetupForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN) return setError(`Şifre en az ${MIN} karakter olmalı.`);
    if (password !== again) return setError("İki şifre aynı değil.");
    setLoading(true);
    haptics.tap();
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hesap kurulamadı");
      haptics.success();
      router.push("/");
      router.refresh();
    } catch (err) {
      haptics.error();
      setError(err instanceof Error ? err.message : "Hesap kurulamadı");
      setLoading(false);
    }
  };

  const field =
    "w-full rounded-xl border border-white/10 bg-zinc-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none";

  return (
    <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <ShieldCheck size={30} weight="duotone" />
          </div>
          <h1 className="text-xl font-bold text-white">Hesabını kur</h1>
          <p className="mx-auto mt-1.5 max-w-xs text-xs text-zinc-400">
            Kendi şifreni belirle. Bu bağlantı bir kez kullanılır; sonra e-posta adresin ve bu şifreyle
            giriş yaparsın.
          </p>
        </div>

        {!token ? (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-400">
            Bağlantı eksik. Sana gönderilen kurulum bağlantısını tam olarak aç.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
                {error}
              </p>
            )}
            {[
              { label: "Yeni şifre", value: password, set: setPassword, auto: "new-password" },
              { label: "Yeni şifre (tekrar)", value: again, set: setAgain, auto: "new-password" },
            ].map((f) => (
              <label key={f.label} className="block">
                <span className="mb-1.5 block text-xs font-medium text-zinc-300">{f.label}</span>
                <span className="relative block">
                  <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="password"
                    required
                    minLength={MIN}
                    autoComplete={f.auto}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className={field}
                  />
                </span>
              </label>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-bold text-zinc-950 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? <SpinnerGap size={18} className="animate-spin" /> : null}
              {loading ? "Kuruluyor..." : "Şifreyi kaydet ve giriş yap"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
