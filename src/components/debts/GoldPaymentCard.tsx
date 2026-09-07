"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Coins, HandCoins, ArrowRight } from "@phosphor-icons/react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { triggerHaptic } from "@/lib/haptics";

interface GoldPaymentCardProps {
  debtId: string;
  goldName: string;
  isPiece: boolean;
  /** Borçta kalan miktar: gram ya da adet. */
  remaining: number;
  /** Bugünkü birim fiyat (marj ve işçilik dahil). */
  unitPriceWithPremiumTL: number;
  onPaid: () => void;
}

const HIZLI_ORANLAR = [0.25, 0.5, 1];

/**
 * Altın borcuna kısmi ödeme.
 *
 * Maaşla altın alıp borcun bir kısmını kapatmak bu uygulamada tipik akış, ama
 * borç altın cinsinden: "1.000 TL ödedim" borcun ne kadar azaldığını söylemez,
 * çünkü kur değişince aynı para farklı gram eder. Bu yüzden girdi gram/adet,
 * TL karşılığı da o günün fiyatından hesaplanıp gider olarak yazılıyor.
 */
export function GoldPaymentCard({
  debtId,
  goldName,
  isPiece,
  remaining,
  unitPriceWithPremiumTL,
  onPaid,
}: GoldPaymentCardProps) {
  const birim = isPiece ? "adet" : "gram";
  const [miktar, setMiktar] = useState<string>("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const sayi = Number(miktar.replace(",", "."));
  const gecerli = Number.isFinite(sayi) && sayi > 0 && sayi <= remaining + 1e-9;
  const tlKarsiligi = gecerli ? sayi * unitPriceWithPremiumTL : 0;
  const kalanSonra = gecerli ? remaining - sayi : remaining;

  const odemeYap = async () => {
    if (!gecerli || kaydediliyor) return;
    setKaydediliyor(true);
    try {
      const res = await fetch(`/api/debts/${debtId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(tlKarsiligi.toFixed(2)),
          method: "NAKIT",
          note: `${formatNumber(sayi, isPiece ? 0 : 2)} ${birim} ${goldName} ödemesi`,
          createExpense: true,
          ...(isPiece ? { goldQuantity: sayi } : { goldGrams: sayi }),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ödeme kaydedilemedi");
      }

      triggerHaptic("success");
      toast.success(
        kalanSonra <= 0
          ? "Borç kapandı. Ödeme ve gider kaydı oluşturuldu."
          : `${formatNumber(sayi, isPiece ? 0 : 2)} ${birim} düşüldü. Kalan: ${formatNumber(
              kalanSonra,
              isPiece ? 0 : 2
            )} ${birim}`
      );
      setMiktar("");
      onPaid();
    } catch (e) {
      triggerHaptic("error");
      toast.error(e instanceof Error ? e.message : "Ödeme kaydedilemedi");
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <div className="glass-card space-y-4 border-emerald-500/25 p-5">
      <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
          <HandCoins size={20} weight="duotone" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Altın Ödemesi Yap</h3>
          <p className="text-[11px] text-zinc-400">
            Verdiğiniz altını {birim} olarak yazın; TL karşılığı bugünkü fiyattan
            gidere işlenir
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {HIZLI_ORANLAR.map((oran) => {
          const deger = isPiece
            ? Math.max(1, Math.round(remaining * oran))
            : Number((remaining * oran).toFixed(2));
          return (
            <button
              key={oran}
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setMiktar(String(deger));
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/10"
            >
              {oran === 1 ? "Tamamı" : `%${oran * 100}`} · {formatNumber(deger, isPiece ? 0 : 2)}{" "}
              {birim}
            </button>
          );
        })}
      </div>

      <div>
        <label
          htmlFor="altin-odeme-miktar"
          className="mb-1.5 block text-xs font-medium text-zinc-300"
        >
          Ödenen miktar ({birim})
        </label>
        <div className="relative">
          <input
            id="altin-odeme-miktar"
            type="number"
            inputMode="decimal"
            min="0"
            step={isPiece ? "1" : "0.01"}
            max={remaining}
            value={miktar}
            onChange={(e) => setMiktar(e.target.value)}
            placeholder={`Kalan: ${formatNumber(remaining, isPiece ? 0 : 2)} ${birim}`}
            className="h-11 w-full rounded-xl border border-white/10 bg-zinc-900 pl-3.5 pr-16 font-mono text-base text-white focus:border-emerald-500 focus:outline-none"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
            {birim}
          </span>
        </div>
        {miktar !== "" && !gecerli && (
          <p className="mt-1 text-[11px] text-rose-400">
            0 ile {formatNumber(remaining, isPiece ? 0 : 2)} {birim} arasında bir değer girin.
          </p>
        )}
      </div>

      {gecerli && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">
              {formatNumber(sayi, isPiece ? 0 : 2)} {birim} ×{" "}
              {formatCurrency(unitPriceWithPremiumTL)}
            </span>
            <span className="font-mono font-bold text-white">{formatCurrency(tlKarsiligi)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px]">
            <span className="text-zinc-500">Ödeme sonrası kalan borç</span>
            <span className="flex items-center gap-1.5 font-mono text-zinc-300">
              {formatNumber(remaining, isPiece ? 0 : 2)}
              <ArrowRight size={11} />
              <span className={kalanSonra <= 0 ? "font-bold text-emerald-400" : "text-white"}>
                {formatNumber(kalanSonra, isPiece ? 0 : 2)} {birim}
              </span>
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={odemeYap}
        disabled={!gecerli || kaydediliyor}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-bold text-zinc-950 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Coins size={16} weight="bold" />
        {kaydediliyor ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
      </button>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        Kayıt iki yere birden işler: borçtan {birim} düşülür, kasadan{" "}
        {gecerli ? formatCurrency(tlKarsiligi) : "ödediğiniz tutar"} gider olarak çıkar.
        Kur sonradan değişse bile bu ödeme bugünkü fiyattan sabit kalır.
      </p>
    </div>
  );
}
