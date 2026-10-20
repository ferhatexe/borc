"use client";

import { useState, useEffect, useMemo } from "react";
import {
  TrendDown,
  PlusCircle,
  CreditCard,
  Trash,
  CaretLeft,
  CaretRight,
  Link as LinkIcon,
} from "@phosphor-icons/react";
import { formatCurrency, formatDateTR, toDateInputValue } from "@/lib/formatters";
import { triggerHaptic } from "@/lib/haptics";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tarih Filtresi
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL");

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
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("KREDI_KARTI");
  const [relatedDebtId, setRelatedDebtId] = useState<string>("");
  const [date, setDate] = useState(toDateInputValue());
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Veri Çekme
  const fetchData = async () => {
    try {
      setLoading(true);
      const [expRes, catRes, debtsRes] = await Promise.all([
        fetch(`/api/expenses?year=${currentYear}&month=${currentMonth}`),
        fetch("/api/categories?type=GIDER"),
        fetch("/api/debts"),
      ]);

      if (expRes.ok) setExpenses(await expRes.json());
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData);
        if (!categoryId && catData.length > 0) {
          setCategoryId(catData[0].id);
        }
      }
      if (debtsRes.ok) {
        const allDebts = await debtsRes.json();
        const cards = allDebts.filter(
          (d: any) => d.type === "KREDI_KARTI" || d.type === "EK_HESAP_KMH"
        );
        setCreditCards(cards);
        // Yöntem "Kredi Kartı" iken kart seçilmezse harcama ne kasadan düşer ne
        // karta yazılır, kaybolur. Bu yüzden ilk kredi kartı önceden seçilir.
        const firstCard = cards.find((d: any) => d.type === "KREDI_KARTI");
        if (firstCard) setRelatedDebtId((prev) => prev || firstCard.id);
      }
    } catch (err) {
      console.error("Gider verileri yüklenemedi:", err);
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

  // Yeni Harcama Kaydet
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !merchant.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          merchant: merchant.trim(),
          categoryId,
          paymentMethod,
          relatedDebtId: relatedDebtId || undefined,
          date,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Harcama kaydedilemedi");

      triggerHaptic("success");
      setShowAddModal(false);
      setAmount("");
      setMerchant("");
      setNote("");
      setRelatedDebtId(
        paymentMethod === "KREDI_KARTI"
          ? (creditCards.find((c: any) => c.type === "KREDI_KARTI")?.id ?? "")
          : ""
      );
      await fetchData();
    } catch (err: any) {
      triggerHaptic("error");
      alert(err.message || "Kayıt sırasında hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Harcama Sil
  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Bu harcama kaydını silmek istediğinize emin misiniz?")) return;

    triggerHaptic("warning");
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        triggerHaptic("success");
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error("Harcama silinemedi", err);
    }
  };

  // Filtreleme
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedCategory !== "ALL" && e.categoryId !== selectedCategory) return false;
      if (selectedMethod !== "ALL" && e.paymentMethod !== selectedMethod) return false;
      return true;
    });
  }, [expenses, selectedCategory, selectedMethod]);

  // Metrikler
  const metrics = useMemo(() => {
    let total = 0;
    let creditCardTotal = 0;
    let cashTotal = 0;

    expenses.forEach((e) => {
      const amt = Number(e.amount || 0);
      total += amt;
      if (e.paymentMethod === "KREDI_KARTI" || e.relatedDebtId) {
        creditCardTotal += amt;
      } else {
        cashTotal += amt;
      }
    });

    return {
      total,
      creditCardTotal,
      cashTotal,
      count: expenses.length,
    };
  }, [expenses]);

  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Üst Başlık & Buton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Giderler & Harcamalar</h1>
          <p className="text-xs text-zinc-400">
            Market, fatura, konut ve kredi kartı harcamalarınız
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(244,63,94,0.25)] hover:brightness-110 active:scale-98 transition-all cursor-pointer"
        >
          <PlusCircle size={18} weight="bold" />
          <span>Yeni Harcama Ekle</span>
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
          <p className="text-[10px] text-zinc-400">Aylık Harcama Tablosu</p>
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
          <p className="text-[11px] text-zinc-400">Bu Ay Toplam Gider</p>
          <p className="text-xl font-bold text-rose-400 font-mono">
            {formatCurrency(metrics.total)}
          </p>
          <p className="text-[10px] text-zinc-500">Tüm harcamalar</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Kredi Kartı Harcamaları</p>
          <p className="text-xl font-bold text-blue-400 font-mono">
            {formatCurrency(metrics.creditCardTotal)}
          </p>
          <p className="text-[10px] text-zinc-500">Karta yansıyan tutar</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Nakit & Havale</p>
          <p className="text-xl font-bold text-zinc-200 font-mono">
            {formatCurrency(metrics.cashTotal)}
          </p>
          <p className="text-[10px] text-zinc-500">Doğrudan ödemeler</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Harcama Kalemi</p>
          <p className="text-xl font-bold text-amber-300 font-mono">{metrics.count} Adet</p>
          <p className="text-[10px] text-zinc-500">Fiş / Fatura sayısı</p>
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
                ? "bg-rose-500 text-white font-bold"
                : "text-zinc-400 hover:text-white bg-white/5"
            }`}
          >
            Tüm Kategoriler ({expenses.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? "bg-rose-500 text-white font-bold"
                  : "text-zinc-400 hover:text-white bg-white/5"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/*
        Ödeme yöntemi süzgeci.

        Süzme mantığı baştan beri vardı ama onu değiştirecek hiçbir denetim
        konmamıştı: `selectedMethod` sonsuza kadar "ALL" kalıyor, yani süzgeç
        ölü kod olarak duruyordu. Düğmeler eklendi.
      */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            ["ALL", "Tüm Yöntemler"],
            ["KREDI_KARTI", "Kredi Kartı"],
            ["BANKA_KARTI", "Banka Kartı"],
            ["HAVALE", "Havale / FAST"],
            ["NAKIT", "Nakit"],
          ] as const
        ).map(([deger, etiket]) => {
          const adet =
            deger === "ALL"
              ? expenses.length
              : expenses.filter((e: any) => e.paymentMethod === deger).length;
          if (deger !== "ALL" && adet === 0) return null;
          return (
            <button
              key={deger}
              type="button"
              onClick={() => setSelectedMethod(deger)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedMethod === deger
                  ? "bg-zinc-200 font-bold text-zinc-900"
                  : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              {etiket} ({adet})
            </button>
          );
        })}
      </div>

      {/* Harcama Listesi */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-500 border-t-transparent mx-auto" />
          <p className="text-xs text-zinc-500">Harcamalar yükleniyor...</p>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center glass-card">
          <TrendDown size={48} className="mx-auto text-zinc-600 mb-3" />
          <h3 className="text-base font-semibold text-zinc-200">
            Bu Ay İçin Kayıtlı Harcama Yok
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-6">
            Günlük harcamalarınızı ve kredi kartı işlemlerinizi kaydederek bütçenizi kontrol altına alın.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 transition-colors"
          >
            <PlusCircle size={18} weight="bold" />
            <span>İlk Harcamanızı Ekleyin</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredExpenses.map((exp) => (
            <div
              key={exp.id}
              className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/70 hover:bg-zinc-900 border border-white/10 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 text-sm shadow-sm"
                  style={{ backgroundColor: exp.category?.color || "#f43f5e" }}
                >
                  <TrendDown size={20} weight="bold" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate">{exp.merchant}</p>
                    {exp.relatedDebt && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold border border-blue-500/20">
                        <CreditCard size={11} />
                        <span>{exp.relatedDebt.title}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                    <span>{exp.category?.name || "Gider"}</span>
                    <span>•</span>
                    <span>{formatDateTR(exp.date)}</span>
                    <span>•</span>
                    <span className="text-zinc-500">{exp.paymentMethod}</span>
                    {exp.note && (
                      <>
                        <span>•</span>
                        <span className="text-zinc-500 truncate max-w-xs">{exp.note}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-base font-bold text-rose-400 font-mono">
                  -{formatCurrency(exp.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteExpense(exp.id)}
                  className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Yeni Harcama Ekleme Modalı */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <TrendDown size={22} className="text-rose-400" />
                <h3 className="text-base font-bold text-white">Yeni Harcama Kaydı Ekle</h3>
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

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Harcama Tutarı *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                    placeholder="750"
                    className="w-full h-11 pl-3.5 pr-10 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white font-mono text-base focus:outline-none focus:border-rose-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">
                    ₺
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  İşyeri / Harcama Tanımı *
                </label>
                <input
                  type="text"
                  required
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Örn: Migros Market, Shell Akaryakıt, Restoran"
                  className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Harcama Kategorisi *
                  </label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full h-11 px-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Ödeme Yöntemi
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => {
                      const method = e.target.value;
                      setPaymentMethod(method);
                      const card = creditCards.find((c: any) => c.type === "KREDI_KARTI");
                      if (method === "KREDI_KARTI") {
                        if (!relatedDebtId && card) setRelatedDebtId(card.id);
                      } else if (creditCards.some((c: any) => c.id === relatedDebtId && c.type === "KREDI_KARTI")) {
                        // Karttan olmayan harcama karta bağlı kalırsa kart ödemesi sanılır.
                        setRelatedDebtId("");
                      }
                    }}
                    className="w-full h-11 px-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="KREDI_KARTI">Kredi Kartı</option>
                    <option value="BANKA_KARTI">Banka Kartı / Hesap</option>
                    <option value="HAVALE">Havale / FAST</option>
                    <option value="NAKIT">Elden Nakit</option>
                  </select>
                </div>
              </div>

              {/* Kredi Kartına Bağlama Seçeneği */}
              {creditCards.length > 0 && (
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <LinkIcon size={14} className="text-blue-400" />
                    <label className="text-xs font-semibold text-zinc-300">
                      Kredi Kartına / Ek Hesaba Bağla
                    </label>
                  </div>
                  <select
                    value={relatedDebtId}
                    onChange={(e) => {
                      setRelatedDebtId(e.target.value);
                      if (e.target.value) setPaymentMethod("KREDI_KARTI");
                    }}
                    className="w-full h-10 px-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Bağlama (Bağımsız Harcama)</option>
                    {creditCards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.title} ({card.type === "KREDI_KARTI" ? "Kredi Kartı" : "KMH"})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-500">
                    Seçilirse harcama tutarı kartın dönem borcuna otomatik olarak yansıtılır.
                  </p>
                </div>
              )}

              {/*
                Tarih kendi satirinda tam genislik kapliyordu; bir tarih icin
                fazla yer. Aciklama ile ayni satiri paylasiyor ve gunluk kullanimda
                neredeyse her zaman "bugun" ya da "dun" oldugu icin iki kisayol
                var - takvimi acmaya gerek kalmiyor.
              */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="harcama-tarihi"
                    className="mb-1.5 block text-xs font-medium text-zinc-300"
                  >
                    Harcama Tarihi *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="harcama-tarihi"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      /* text-base sart: iOS 16px altindaki alanlara odaklanildiginda
                         sayfayi kendiliginden yakinlastiriyor. */
                      className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3 text-base text-white focus:border-rose-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setDate(toDateInputValue())}
                      className="h-11 shrink-0 rounded-xl border border-white/10 bg-white/5 px-2.5 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/10"
                    >
                      Bugün
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const dun = new Date();
                        dun.setDate(dun.getDate() - 1);
                        setDate(toDateInputValue(dun));
                      }}
                      className="h-11 shrink-0 rounded-xl border border-white/10 bg-white/5 px-2.5 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/10"
                    >
                      Dün
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="harcama-notu"
                    className="mb-1.5 block text-xs font-medium text-zinc-300"
                  >
                    Açıklama & Not (Opsiyonel)
                  </label>
                  <input
                    id="harcama-notu"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ürün veya fiş notu"
                    className="h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 text-xs text-white focus:border-rose-500 focus:outline-none"
                  />
                </div>
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
                  disabled={isSubmitting || !amount || !merchant.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white disabled:opacity-50"
                >
                  {isSubmitting ? "Kaydediliyor..." : "Harcamayı Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
