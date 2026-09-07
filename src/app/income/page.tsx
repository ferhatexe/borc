"use client";

import { useState, useEffect, useMemo } from "react";
import {
  TrendUp,
  PlusCircle,
  Repeat,
  Trash,
  CaretLeft,
  CaretRight,
  } from "@phosphor-icons/react";
import { formatCurrency, formatDateTR, toDateInputValue } from "@/lib/formatters";
import { triggerHaptic } from "@/lib/haptics";

export default function IncomePage() {
  const [incomes, setIncomes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tarih Filtresi
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);

  /*
   * `?ekle=1` ile gelinirse form dogrudan acilir.
   *
   * Harcama eklemek icin once Giderler sayfasina gidip sonra dugmeyi bulmak
   * gerekiyordu; alt cubuktaki ekleme dugmesi buraya boyle baglaniyor.
   * `useSearchParams` yerine dogrudan adres okunuyor: bu sayfa zaten istemci
   * bileseni ve o kanca statik render icin Suspense sarmalayicisi istiyor.
   */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("ekle")) {
      setShowAddModal(true);
    }
  }, []);

  const [amount, setAmount] = useState<number | "">("");
  const [source, setSource] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(toDateInputValue());
  const [isRecurring, setIsRecurring] = useState(true);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Veri Çekme
  const fetchData = async () => {
    try {
      setLoading(true);
      const [incRes, catRes] = await Promise.all([
        fetch(`/api/income?year=${currentYear}&month=${currentMonth}`),
        fetch("/api/categories?type=GELIR"),
      ]);

      if (incRes.ok) setIncomes(await incRes.json());
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData);
        if (!categoryId && catData.length > 0) {
          setCategoryId(catData[0].id);
        }
      }
    } catch (err) {
      console.error("Gelir verileri yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentYear, currentMonth]);

  // Ay Değiştirme
  const handlePrevMonth = () => {
    triggerHaptic("selection");
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    triggerHaptic("selection");
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // Yeni Gelir Kaydet
  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !source.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          source: source.trim(),
          categoryId,
          date,
          isRecurring,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Gelir kaydedilemedi");

      triggerHaptic("success");
      setShowAddModal(false);
      setAmount("");
      setSource("");
      setNote("");
      await fetchData();
    } catch (err: any) {
      triggerHaptic("error");
      alert(err.message || "Kayıt sırasında hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gelir Sil
  const handleDeleteIncome = async (id: string) => {
    if (!confirm("Bu gelir kaydını silmek istediğinize emin misiniz?")) return;

    triggerHaptic("warning");
    try {
      const res = await fetch(`/api/income/${id}`, { method: "DELETE" });
      if (res.ok) {
        triggerHaptic("success");
        setIncomes((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (err) {
      console.error("Gelir silinemedi", err);
    }
  };

  // Filtrelenmiş Gelirler
  const filteredIncomes = useMemo(() => {
    if (selectedCategory === "ALL") return incomes;
    return incomes.filter((i) => i.categoryId === selectedCategory);
  }, [incomes, selectedCategory]);

  // Metrik Hesaplamaları
  const metrics = useMemo(() => {
    let total = 0;
    let recurring = 0;
    let nonRecurring = 0;

    incomes.forEach((i) => {
      const amt = Number(i.amount || 0);
      total += amt;
      if (i.isRecurring) recurring += amt;
      else nonRecurring += amt;
    });

    return {
      total,
      recurring,
      nonRecurring,
      count: incomes.length,
    };
  }, [incomes]);

  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Üst Başlık & Buton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Gelirler & Nakit Girişleri</h1>
          <p className="text-xs text-zinc-400">
            Maaş, kira, ek kazanç ve düzenli gelir akışlarınız
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-bold text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:brightness-110 active:scale-98 transition-all cursor-pointer"
        >
          <PlusCircle size={18} weight="bold" />
          <span>Yeni Gelir Ekle</span>
        </button>
      </div>

      {/* Ay Seçici Çubuğu */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 border border-white/10 shadow-sm">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
        >
          <CaretLeft size={18} />
        </button>

        <div className="text-center">
          <span className="text-sm font-bold text-white">
            {monthNames[currentMonth - 1]} {currentYear}
          </span>
          <p className="text-[10px] text-zinc-400">Aylık Gelir Tablosu</p>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
        >
          <CaretRight size={18} />
        </button>
      </div>

      {/* Özet Metrik Kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Bu Ay Toplam Gelir</p>
          <p className="text-xl font-bold text-emerald-400 font-mono">
            {formatCurrency(metrics.total)}
          </p>
          <p className="text-[10px] text-zinc-500">Tüm girişler toplamı</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Düzenli / Maaş Geliri</p>
          <p className="text-xl font-bold text-white font-mono">
            {formatCurrency(metrics.recurring)}
          </p>
          <p className="text-[10px] text-zinc-500">Garantili girişler</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Ek / Değişken Gelir</p>
          <p className="text-xl font-bold text-teal-300 font-mono">
            {formatCurrency(metrics.nonRecurring)}
          </p>
          <p className="text-[10px] text-zinc-500">Prim, satış, ek iş</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Gelir Kalemi</p>
          <p className="text-xl font-bold text-zinc-200 font-mono">{metrics.count} Adet</p>
          <p className="text-[10px] text-zinc-500">Kayıtlı giriş sayısı</p>
        </div>
      </div>

      {/* Kategori Filtreleri */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === "ALL"
                ? "bg-emerald-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-white bg-white/5"
            }`}
          >
            Tüm Kategoriler ({incomes.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? "bg-emerald-500 text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white bg-white/5"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Gelir Listesi */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto" />
          <p className="text-xs text-zinc-500">Gelirler yükleniyor...</p>
        </div>
      ) : filteredIncomes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center glass-card">
          <TrendUp size={48} className="mx-auto text-zinc-600 mb-3" />
          <h3 className="text-base font-semibold text-zinc-200">
            Bu Ay İçin Kayıtlı Gelir Yok
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-6">
            Maaş, kira veya ek kazançlarınızı kaydederek aylık nakit akışınızı netleştirin.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-bold text-zinc-950 shadow-md hover:brightness-110 transition-colors"
          >
            <PlusCircle size={18} weight="bold" />
            <span>İlk Gelirinizi Ekleyin</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredIncomes.map((inc) => (
            <div
              key={inc.id}
              className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/70 hover:bg-zinc-900 border border-white/10 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 text-sm shadow-sm"
                  style={{ backgroundColor: inc.category?.color || "#10b981" }}
                >
                  <TrendUp size={20} weight="bold" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate">{inc.source}</p>
                    {inc.isRecurring && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/20">
                        <Repeat size={11} />
                        <span>Düzenli</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                    <span>{inc.category?.name || "Gelir"}</span>
                    <span>•</span>
                    <span>{formatDateTR(inc.date)}</span>
                    {inc.note && (
                      <>
                        <span>•</span>
                        <span className="text-zinc-500 truncate max-w-xs">{inc.note}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-base font-bold text-emerald-400 font-mono">
                  +{formatCurrency(inc.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteIncome(inc.id)}
                  className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Yeni Gelir Ekleme Modalı */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <TrendUp size={22} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">Yeni Gelir Kaydı Ekle</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveIncome} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Gelir Tutarı *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                    placeholder="35.000"
                    className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white font-mono text-base focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">
                    ₺
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Gelir Tanımı / Kaynağı *
                </label>
                <input
                  type="text"
                  required
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Örn: Eylül Maaşı, Daire Kirası, Danışmanlık"
                  className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Gelir Kategorisi *
                </label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Giriş Tarihi *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="h-4 w-4 rounded bg-zinc-800 border-white/20 text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="text-xs font-medium text-zinc-200">Tekrarlayan Gelir</span>
                      <p className="text-[10px] text-zinc-500">Her ay düzenli yatar</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Açıklama & Not (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="İlgili bordro, proje veya banka detayı"
                  className="w-full h-10 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-white/5"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !amount || !source.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 disabled:opacity-50"
                >
                  {isSubmitting ? "Kaydediliyor..." : "Geliri Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
