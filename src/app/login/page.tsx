"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, EnvelopeSimple, ShieldCheck, SpinnerGap } from "@phosphor-icons/react";
import { haptics } from "@/lib/haptics";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    haptics.tap();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        haptics.error();
        setError(data.error || "Giriş başarısız oldu");
        setLoading(false);
        return;
      }

      haptics.success();
      router.push("/");
      router.refresh();
    } catch {
      haptics.error();
      setError("Sunucuya bağlanılamadı. Lütfen tekrar deneyiniz.");
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        {/* Arka plan parlaklık efekti */}
        <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="glass-card p-8 shadow-2xl relative z-10 border border-white/10">
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
              <ShieldCheck size={32} weight="duotone" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              BORÇÖLÇME KASA
            </h1>
            <p className="mt-1.5 text-xs text-zinc-400 max-w-xs mx-auto">
              Kişisel borç, kredi, altın ve nakit akışınızı güvenle yönetin.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-400 flex items-center gap-2">
              <span className="font-semibold">Hata:</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                E-posta Adresi
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                  <EnvelopeSimple size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@eposta.com"
                  className="w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Şifre
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifreniz"
                  className="w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:brightness-110 disabled:opacity-50 touch-feedback"
            >
              {loading ? (
                <>
                  <SpinnerGap size={18} className="animate-spin" />
                  <span>Doğrulanıyor...</span>
                </>
              ) : (
                <span>Korumalı Giriş Yap</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center text-[11px] text-zinc-500">
            Tek kullanıcılı özel kasa · Veriler PostgreSQL üzerinde şifreli saklanır
          </div>
        </div>
      </div>
    </div>
  );
}
