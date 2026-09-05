"use client";

import { useState, useEffect, useMemo } from "react";
import { calculateGoldValueTL } from "@/lib/finance/gold";
import { formatCurrency } from "@/lib/formatters";
import { Coins, Sparkle, Tag, Info, User } from "@phosphor-icons/react";

export interface GoldDebtFormData {
  title: string;
  goldType: string;
  quantity?: number;
  grams?: number;
  karat?: number;
  priceSource: "CANLI" | "MANUEL";
  manualUnitPrice?: number;
  premiumTL: number;
  creditorName: string;
  dueDate?: string;
  isInterestFree: boolean;
  notes?: string;
}

interface GoldDebtFormProps {
  initialData?: Partial<GoldDebtFormData>;
  onChange: (data: GoldDebtFormData, isValid: boolean) => void;
}

// Varsayılan Piyasa Referans Fiyatları (Canlı API entegrasyonu öncesi sağlam piyasa bazları)
const MARKET_PRICES: Record<string, { price: number; isPiece: boolean; defaultKarat?: number; defaultPremium?: number }> = {
  GRAM_ALTIN: { price: 3350, isPiece: false, defaultKarat: 24, defaultPremium: 0 },
  CEYREK: { price: 5490, isPiece: true, defaultKarat: 22, defaultPremium: 0 },
  YARIM: { price: 10980, isPiece: true, defaultKarat: 22, defaultPremium: 0 },
  TAM: { price: 21960, isPiece: true, defaultKarat: 22, defaultPremium: 0 },
  ATA: { price: 22600, isPiece: true, defaultKarat: 22, defaultPremium: 0 },
  BILEZIK_22: { price: 3350, isPiece: false, defaultKarat: 22, defaultPremium: 0 },
  ZINCIR_21_HALEP: { price: 3350, isPiece: false, defaultKarat: 21, defaultPremium: 200 }, // Kural: +200 TL/gr
  BILEZIK_14: { price: 3350, isPiece: false, defaultKarat: 14, defaultPremium: 0 },
};

const GOLD_TYPE_OPTIONS = [
  { id: "GRAM_ALTIN", name: "24 Ayar Gram Altın", desc: "Has gram altın", isPiece: false },
  { id: "CEYREK", name: "Çeyrek Altın", desc: "Adet bazlı (1.75 gr)", isPiece: true },
  { id: "YARIM", name: "Yarım Altın", desc: "Adet bazlı (3.50 gr)", isPiece: true },
  { id: "TAM", name: "Tam Altın", desc: "Adet bazlı (7.00 gr)", isPiece: true },
  { id: "ATA", name: "Ata Lira / Cumhuriyet", desc: "Adet bazlı (7.216 gr)", isPiece: true },
  { id: "BILEZIK_22", name: "22 Ayar Bilezik", desc: "Gram bazlı (Marj: 0 ₺/gr)", isPiece: false },
  {
    id: "ZINCIR_21_HALEP",
    name: "21 Ayar Halep Zinciri",
    desc: "Gram bazlı (+200 ₺/gr Marj)",
    isPiece: false,
    highlight: true,
  },
  { id: "BILEZIK_14", name: "14 Ayar Altın", desc: "Gram bazlı (585 milyem)", isPiece: false },
];

export function GoldDebtForm({ initialData, onChange }: GoldDebtFormProps) {
  const [goldType, setGoldType] = useState(initialData?.goldType || "CEYREK");
  const [priceSource, setPriceSource] = useState<"CANLI" | "MANUEL">(
    initialData?.priceSource || "CANLI"
  );

  const isPiece = MARKET_PRICES[goldType]?.isPiece ?? true;

  const [quantity, setQuantity] = useState<number>(initialData?.quantity || 2);
  const [grams, setGrams] = useState<number>(initialData?.grams || 25);
  const [karat, setKarat] = useState<number>(
    initialData?.karat || MARKET_PRICES[goldType]?.defaultKarat || 22
  );

  // Marj kuralı: 21 ayar Halep zinciri seçilirse varsayılan 200 TL/gr
  const [premiumTL, setPremiumTL] = useState<number>(
    initialData?.premiumTL !== undefined
      ? initialData.premiumTL
      : MARKET_PRICES[goldType]?.defaultPremium || 0
  );

  const [manualUnitPrice, setManualUnitPrice] = useState<number>(
    initialData?.manualUnitPrice || MARKET_PRICES[goldType]?.price || 5490
  );

  const [creditorName, setCreditorName] = useState(initialData?.creditorName || "");
  const [dueDate, setDueDate] = useState(initialData?.dueDate || "");
  const [isInterestFree, setIsInterestFree] = useState(
    initialData?.isInterestFree !== undefined ? initialData.isInterestFree : true
  );
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Altın tipi değişince marj ve varsayılanları otomatik güncelle
  const handleTypeChange = (newType: string) => {
    setGoldType(newType);
    const meta = MARKET_PRICES[newType];
    if (meta) {
      setKarat(meta.defaultKarat || 22);
      setPremiumTL(meta.defaultPremium || 0);
      setManualUnitPrice(meta.price);
    }
  };

  // Canlı TL Karşılığı Hesaplama
  const valueCalculation = useMemo(() => {
    try {
      const pureGoldGramSellTL = 3350; // Has altın gram referans
      const unitPriceTL =
        priceSource === "MANUEL" ? manualUnitPrice : MARKET_PRICES[goldType]?.price || 5490;

      const res = calculateGoldValueTL({
        goldType,
        quantity: isPiece ? quantity : undefined,
        grams: !isPiece ? grams : undefined,
        karat,
        unitPriceTL,
        pureGoldGramSellTL,
        premiumTL,
      });

      return {
        totalTL: res.totalTL.toNumber(),
        unitPriceWithPremiumTL: res.unitPriceWithPremiumTL.toNumber(),
      };
    } catch {
      return null;
    }
  }, [goldType, isPiece, quantity, grams, karat, priceSource, manualUnitPrice, premiumTL]);

  useEffect(() => {
    const selectedOption = GOLD_TYPE_OPTIONS.find((o) => o.id === goldType);
    const title = `${selectedOption?.name || "Altın Borcu"} (${
      isPiece ? `${quantity} Adet` : `${grams} gr`
    })${creditorName ? ` - ${creditorName}` : ""}`;

    const isValid =
      creditorName.trim().length > 0 &&
      (isPiece ? quantity > 0 : grams > 0) &&
      (priceSource === "CANLI" || manualUnitPrice > 0);

    onChange(
      {
        title,
        goldType,
        quantity: isPiece ? Number(quantity) : undefined,
        grams: !isPiece ? Number(grams) : undefined,
        karat: Number(karat),
        priceSource,
        manualUnitPrice: priceSource === "MANUEL" ? Number(manualUnitPrice) : undefined,
        premiumTL: Number(premiumTL),
        creditorName,
        dueDate: dueDate || undefined,
        isInterestFree,
        notes,
      },
      isValid
    );
  }, [
    goldType,
    isPiece,
    quantity,
    grams,
    karat,
    priceSource,
    manualUnitPrice,
    premiumTL,
    creditorName,
    dueDate,
    isInterestFree,
    notes,
  ]);

  return (
    <div className="space-y-6">
      {/* Altın Tipi Seçimi */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-300">Altın / Ziynet Türü *</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {GOLD_TYPE_OPTIONS.map((opt) => {
            const isSel = goldType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleTypeChange(opt.id)}
                className={`relative p-3 rounded-xl border text-left transition-all ${
                  isSel
                    ? "bg-yellow-500/15 border-yellow-500 ring-1 ring-yellow-500/40 text-yellow-300"
                    : "bg-zinc-900/40 border-white/5 text-zinc-400 hover:bg-zinc-900/70"
                }`}
              >
                <p className="text-xs font-semibold truncate">{opt.name}</p>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{opt.desc}</p>
                {opt.highlight && (
                  <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded bg-amber-500 text-zinc-950 text-[9px] font-bold">
                    +200₺ Marj
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Miktar (Adet vs Gram) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isPiece ? (
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Adet / Tane Sayısı *
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                required
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value))}
                placeholder="2"
                className="w-full h-11 pl-3.5 pr-12 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500 font-mono text-base"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
                Adet
              </span>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Toplam Gramaj (gr) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                step="0.01"
                required
                value={grams || ""}
                onChange={(e) => setGrams(Number(e.target.value))}
                placeholder="25.00"
                className="w-full h-11 pl-3.5 pr-12 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500 font-mono text-base"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
                Gram
              </span>
            </div>
          </div>
        )}

        {/* Marj / İşçilik Farkı */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Birim Başına Marj / İşçilik Farkı (₺)
          </label>
          <div className="relative">
            <input
              type="number"
              step="10"
              value={premiumTL}
              onChange={(e) => setPremiumTL(Number(e.target.value))}
              placeholder="0"
              className="w-full h-11 pl-3.5 pr-14 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500 font-mono text-base"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">
              {isPiece ? "₺/Adet" : "₺/Gram"}
            </span>
          </div>
          {goldType === "ZINCIR_21_HALEP" && (
            <p className="text-[10px] text-amber-400 mt-1">
              * 21 ayar Halep zinciri için kural gereği +200 TL/gr çarşı marjı uygulandı.
            </p>
          )}
        </div>
      </div>

      {/* Fiyat Kaynağı */}
      <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300">Fiyat Kaynağı</label>
          <div className="flex gap-1.5 bg-zinc-900 p-1 rounded-lg border border-white/5">
            <button
              type="button"
              onClick={() => setPriceSource("CANLI")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                priceSource === "CANLI" ? "bg-yellow-500 text-zinc-950 font-bold" : "text-zinc-400"
              }`}
            >
              Canlı Piyasa
            </button>
            <button
              type="button"
              onClick={() => setPriceSource("MANUEL")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                priceSource === "MANUEL" ? "bg-yellow-500 text-zinc-950 font-bold" : "text-zinc-400"
              }`}
            >
              Manuel Fiyat
            </button>
          </div>
        </div>

        {priceSource === "MANUEL" && (
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Özel Birim Alış / Geri Ödeme Fiyatı (₺)
            </label>
            <input
              type="number"
              step="10"
              value={manualUnitPrice}
              onChange={(e) => setManualUnitPrice(Number(e.target.value))}
              placeholder="5.490"
              className="w-full h-10 px-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500 font-mono"
            />
          </div>
        )}
      </div>

      {/* Alacaklı Kişi & Vade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Borç Alınan Kişi / Kuyumcu *
          </label>
          <div className="relative">
            <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              required
              value={creditorName}
              onChange={(e) => setCreditorName(e.target.value)}
              placeholder="Örn: Mehmet Bey (Dayı) veya Atlas Kuyumculuk"
              className="w-full h-11 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Geri Ödeme Vade Tarihi (Opsiyonel)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
          />
        </div>
      </div>

      {/* Canlı Güncel TL Değeri Paneli */}
      {valueCalculation && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-950/30 via-zinc-900 to-zinc-900 border border-yellow-500/30 shadow-[0_0_25px_rgba(234,179,8,0.1)] space-y-3">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
            <Coins size={18} weight="fill" className="text-yellow-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Güncel TL Karşılığı Özeti
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-zinc-400">Toplam TL Borç Karşılığı</p>
              <p className="text-xl font-bold text-yellow-400 font-mono">
                {formatCurrency(valueCalculation.totalTL)}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-zinc-400">Efektif Birim Fiyat (Marj Dahil)</p>
              <p className="text-sm font-semibold text-white font-mono">
                {formatCurrency(valueCalculation.unitPriceWithPremiumTL)}{" "}
                <span className="text-[10px] text-zinc-400 font-normal">
                  / {isPiece ? "adet" : "gr"}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
