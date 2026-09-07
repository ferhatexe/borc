"use client";

import { useState, useEffect, useMemo } from "react";
import { calculateGoldDebtLiveTL } from "@/lib/finance/goldValuation";
import { defaultKaratForGoldType } from "@/lib/finance/gold";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import { useGoldPrices } from "@/lib/hooks/useGoldPrices";
import { useAppSettings } from "@/lib/hooks/useAppSettings";
import { isPieceGoldType } from "@/lib/gold/types";
import { Coins, User, WarningCircle } from "@phosphor-icons/react";
import { NotesField } from "./NotesField";

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

/*
 * Burada FİYAT TUTULMAZ. Daha önce koda gömülü bir tablo vardı (gram has altın
 * için 3.350 TL gibi) ve önizleme, kaydedilen tutarın yarısını gösteriyordu.
 * Fiyatlar /api/gold'dan, marjlar Ayarlar'dan gelir; bu tablo yalnızca
 * ürünün adet mi gram mı olduğunu ve varsayılan ayarını taşır.
 */

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
  const gold = useGoldPrices();
  const { settings } = useAppSettings();

  const [goldType, setGoldType] = useState(initialData?.goldType || "CEYREK");
  const [priceSource, setPriceSource] = useState<"CANLI" | "MANUEL">(
    initialData?.priceSource || "CANLI"
  );

  const isPiece = isPieceGoldType(goldType);

  const [quantity, setQuantity] = useState<number>(initialData?.quantity ?? 0);
  const [grams, setGrams] = useState<number>(initialData?.grams ?? 0);
  const [karat, setKarat] = useState<number>(
    initialData?.karat || defaultKaratForGoldType(goldType)
  );

  // Marj Ayarlar'dan gelir (21 ayar varsayılanı +200 TL/gr).
  const [premiumTL, setPremiumTL] = useState<number>(initialData?.premiumTL ?? 0);
  const [premiumTouched, setPremiumTouched] = useState(initialData?.premiumTL !== undefined);

  const [manualUnitPrice, setManualUnitPrice] = useState<number>(
    initialData?.manualUnitPrice ?? 0
  );

  /** Seçili ürünün canlı kaydı. */
  const priceRecord = useMemo(
    () => gold.prices.find((p) => p.goldType === goldType) ?? null,
    [gold.prices, goldType]
  );

  // Kullanıcı elle değiştirmediyse marjı ayarlardaki değerle senkron tut.
  useEffect(() => {
    if (premiumTouched) return;
    setPremiumTL(settings.goldMargins[goldType] ?? 0);
  }, [goldType, settings.goldMargins, premiumTouched]);

  const [creditorName, setCreditorName] = useState(initialData?.creditorName || "");
  const [dueDate, setDueDate] = useState(initialData?.dueDate || "");
  /*
   * Altın borcu bu uygulamada faiz işletmez: değer, borçlu olunan altının
   * gün fiyatından karşılığıdır. Bayrak kayıt ve raporlar için tutuluyor ama
   * her zaman "faizsiz". Değiştirilebilir gibi göstermek yanıltıcı olurdu -
   * hesaplamada karşılığı yok.
   */
  const isInterestFree = initialData?.isInterestFree ?? true;
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Altın tipi değişince ayar ve marj varsayılanlarını güncelle.
  const handleTypeChange = (newType: string) => {
    setGoldType(newType);
    setKarat(defaultKaratForGoldType(newType));
    setPremiumTouched(false);
    setPremiumTL(settings.goldMargins[newType] ?? 0);

    // Manuel fiyat için başlangıç değeri canlı kotasyondan alınır.
    const live = gold.prices.find((p) => p.goldType === newType);
    setManualUnitPrice(live?.sellPrice ?? 0);
  };

  /*
   * Önizleme, sunucunun kullandığı fonksiyonun aynısını çağırır
   * (calculateGoldDebtLiveTL). Böylece "önizlemede şu, kaydedince bu" farkı
   * oluşamaz. Canlı fiyat yoksa hesap yapılmaz; ekranda uyarı gösterilir.
   */
  const valueCalculation = useMemo(() => {
    const hasAmount = isPiece ? quantity > 0 : grams > 0;
    if (!hasAmount) return null;
    if (priceSource === "CANLI" && gold.prices.length === 0) return null;
    if (priceSource === "MANUEL" && manualUnitPrice <= 0) return null;

    try {
      const res = calculateGoldDebtLiveTL(
        {
          goldType,
          quantity: isPiece ? quantity : null,
          grams: isPiece ? null : grams,
          karat,
          premiumTL,
          priceSource,
          manualUnitPrice: priceSource === "MANUEL" ? manualUnitPrice : null,
        },
        gold.prices,
        gold.pureGramSellTL,
        { millesimalMap: settings.goldMillesimal, margins: settings.goldMargins }
      );

      return { totalTL: res.totalTL, unitPriceWithPremiumTL: res.unitPriceWithPremiumTL };
    } catch {
      return null;
    }
  }, [
    goldType,
    isPiece,
    quantity,
    grams,
    karat,
    priceSource,
    manualUnitPrice,
    premiumTL,
    gold.prices,
    gold.pureGramSellTL,
    settings.goldMillesimal,
    settings.goldMargins,
  ]);

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

      {/* Canlı fiyat alinamadiysa tutar gosterme; sebebini soyle. */}
      {priceSource === "CANLI" && !gold.loading && gold.prices.length === 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Canlı altın fiyatı alınamadı</p>
            <p className="mt-0.5 text-amber-200/80">
              {gold.error ?? "Fiyat servisine ulaşılamıyor."} TL karşılığı hesaplanamıyor.
              Borcu yine de kaydedebilirsiniz; fiyat geldiğinde otomatik hesaplanır.
              Dilerseniz aşağıdan &quot;Manuel&quot; fiyat girin.
            </p>
          </div>
        </div>
      )}

      {/* Canlı Güncel TL Değeri Paneli */}
      {valueCalculation && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-950/30 via-zinc-900 to-zinc-900 border border-yellow-500/30 shadow-[0_0_25px_rgba(234,179,8,0.1)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <Coins size={18} weight="fill" className="text-yellow-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Güncel TL Karşılığı Özeti
              </span>
            </div>
            {gold.source && priceSource === "CANLI" && (
              <span className="text-[10px] text-zinc-500">
                {gold.source}
                {gold.fetchedAt && ` · ${formatDate(gold.fetchedAt, "dd.MM HH:mm")}`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-zinc-400">Toplam TL Borç Karşılığı</p>
              <p className="text-xl font-bold text-yellow-400 font-mono tabular-nums">
                {formatCurrency(valueCalculation.totalTL)}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-zinc-400">Efektif Birim Fiyat (Marj Dahil)</p>
              <p className="text-sm font-semibold text-white font-mono tabular-nums">
                {formatCurrency(valueCalculation.unitPriceWithPremiumTL)}{" "}
                <span className="text-[10px] text-zinc-400 font-normal">
                  / {isPiece ? "adet" : "gr"}
                </span>
              </p>
              {/* Rakamin nereden geldigi acikca yazilir. */}
              {priceSource === "CANLI" && priceRecord && (
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  {formatNumber(priceRecord.sellPrice, 2)} piyasa
                  {premiumTL > 0 && ` + ${formatNumber(premiumTL, 0)} marj`}
                  {priceRecord.source ? ` · ${priceRecord.source}` : ""}
                </p>
              )}
            </div>
          </div>

          {gold.warning && priceSource === "CANLI" && (
            <p className="text-[10px] text-amber-300/90">{gold.warning}</p>
          )}
        </div>
      )}

      <NotesField value={notes} onChange={setNotes} />
    </div>
  );
}
