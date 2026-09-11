"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  CreditCard,
  Bank,
  Vault,
  Coins,
  UsersThree,
  Scroll,
  CalendarCheck,
  DotsThreeCircle,
  MagnifyingGlass,
  ArrowRight,
  Clock,
  Lightning,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatCurrency, formatDateTR } from "@/lib/formatters";
import { triggerHaptic } from "@/lib/haptics";
import { SwipeableCard } from "@/components/shared/SwipeableCard";
import { InstitutionLogo } from "@/components/shared/InstitutionLogo";

export default function DebtsPage() {
  const router = useRouter();
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedInstId, setSelectedInstId] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"AMOUNT_DESC" | "AMOUNT_ASC" | "DATE_ASC">("AMOUNT_DESC");

  const [valuations, setValuations] = useState<Record<string, any>>({});
  const [totals, setTotals] = useState<{
    totalDebtTL: number;
    dueThisMonthTL: number;
    overdueTL: number;
    totalAccruedInterestTL: number;
  } | null>(null);
  const [goldWarning, setGoldWarning] = useState<string | null>(null);

  /**
   * Balances, accrued interest and the live gold value are computed on the
   * server so this page shows exactly the same numbers as the dashboard.
   */
  const fetchDebts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/debts?withValuation=true");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Borçlar yüklenemedi");

      setDebts(data.debts ?? []);
      setValuations(
        Object.fromEntries((data.valuations ?? []).map((v: any) => [v.id, v]))
      );
      setTotals(data.totals ?? null);
      setGoldWarning(data.goldWarning ?? null);
    } catch (e) {
      console.error("Borçlar yüklenemedi:", e);
      toast.error(e instanceof Error ? e.message : "Borçlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebts();
  }, []);

  // Kurumlar listesi (Filtre için benzersiz kurumlar)
  const institutions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    debts.forEach((d) => {
      if (d.institution) {
        map.set(d.institution.id, { id: d.institution.id, name: d.institution.name });
      }
    });
    return Array.from(map.values());
  }, [debts]);

  // Sunucunun hesapladığı güncel bakiye (işlemiş faiz ve canlı altın dahil).
  const getDebtAmount = (d: any): number => valuations[d.id]?.outstandingTL ?? 0;

  // Filtreleme ve Sıralama
  const filteredDebts = useMemo(() => {
    return debts
      .filter((d) => {
        if (selectedType !== "ALL" && d.type !== selectedType) return false;
        if (selectedInstId !== "ALL" && d.institutionId !== selectedInstId) return false;
        if (search.trim()) {
          const s = search.toLowerCase();
          const matchTitle = d.title?.toLowerCase().includes(s);
          const matchInst = d.institution?.name?.toLowerCase().includes(s);
          const matchNotes = d.notes?.toLowerCase().includes(s);
          if (!matchTitle && !matchInst && !matchNotes) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const amtA = getDebtAmount(a);
        const amtB = getDebtAmount(b);
        if (sortBy === "AMOUNT_DESC") return amtB - amtA;
        if (sortBy === "AMOUNT_ASC") return amtA - amtB;
        if (sortBy === "DATE_ASC") {
          const dateA = new Date(a.startDate || 0).getTime();
          const dateB = new Date(b.startDate || 0).getTime();
          return dateA - dateB;
        }
        return 0;
      });
  }, [debts, selectedType, selectedInstId, search, sortBy]);

  // Toplamlar da sunucudan gelir; "bu ay ödenecek" yalnızca vadesi bu ay olan
  // ve henüz ödenmemiş kalemleri içerir.
  const metrics = useMemo(
    () => ({
      totalRemaining: totals?.totalDebtTL ?? 0,
      monthlyObligation: totals?.dueThisMonthTL ?? 0,
      activeCount: debts.length,
    }),
    [totals, debts.length]
  );

  /**
   * Kart üzerindeki tür etiketi.
   *
   * Ham enum basılıyordu: "TAKSITLI KREDI", "EK HESAP KMH". Ekranda okunan
   * metin veritabanı sabiti gibi görünmemeli.
   */
  const TUR_ETIKETLERI: Record<string, string> = {
    TAKSITLI_KREDI: "Taksitli Kredi",
    KREDI_KARTI: "Kredi Kartı",
    EK_HESAP_KMH: "KMH / Ek Hesap",
    ALTIN_BORCU: "Altın Borcu",
    KISI_BORCU: "Kişi Borcu",
    SENET_CEK: "Senet / Çek",
    DUZENLI_ODEME: "Düzenli Ödeme",
    DIGER: "Diğer",
  };

  const getDebtIcon = (type: string) => {
    switch (type) {
      case "TAKSITLI_KREDI":
        return Bank;
      case "KREDI_KARTI":
        return CreditCard;
      case "EK_HESAP_KMH":
        return Vault;
      case "ALTIN_BORCU":
        return Coins;
      case "KISI_BORCU":
        return UsersThree;
      case "SENET_CEK":
        return Scroll;
      case "DUZENLI_ODEME":
        return CalendarCheck;
      default:
        return DotsThreeCircle;
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Borçlar & Yükümlülükler</h1>
          <p className="text-xs text-zinc-400">
            Tüm banka kredileri, kart ekstreleri, altın ve şahıs borçlarınız
          </p>
        </div>

        <Link
          href="/debts/new"
          onClick={() => triggerHaptic("selection")}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all hover:brightness-110 active:scale-98"
        >
          <PlusCircle size={18} weight="bold" />
          <span>Yeni Borç Ekle</span>
        </Link>
      </div>

      {/* Üst Metrikler */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Toplam Kalan Borç Yükü</p>
          <p className="text-2xl font-bold text-white font-mono">
            {formatCurrency(metrics.totalRemaining)}
          </p>
          <p className="text-[10px] text-zinc-500">Tüm aktif borç ve krediler</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Bu Ay Ödenecek Taksit & Yükümlülük</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono">
            {formatCurrency(metrics.monthlyObligation)}
          </p>
          <p className="text-[10px] text-zinc-500">Kredi taksitleri + vadesi bu ay gelen kart borcu</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Aktif Kayıt Sayısı</p>
          <p className="text-2xl font-bold text-teal-400 font-mono">{metrics.activeCount} Adet</p>
          <p className="text-[10px] text-zinc-500">Farklı borç kalemi</p>
        </div>
      </div>

      {/* Altın fiyatı canlı değilse toplamların dayandığı veriyi açıkça bildir */}
      {goldWarning && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200"
        >
          {goldWarning}
        </div>
      )}

      {/* Arama & Filtreleme Çubuğu */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-3">
        <div className="flex flex-wrap gap-2.5">
          {/* Arama */}
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlass
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Borç adı veya banka ara..."
              className="w-full h-10 pl-10 pr-4 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Kurum Filtresi */}
          {institutions.length > 0 && (
            <select
              value={selectedInstId}
              onChange={(e) => setSelectedInstId(e.target.value)}
              className="h-10 px-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-zinc-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Tüm Kurumlar</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          )}

          {/* Sıralama */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-10 px-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-zinc-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="AMOUNT_DESC">Tutar: Yüksekten Düşüğe</option>
            <option value="AMOUNT_ASC">Tutar: Düşükten Yükseğe</option>
            <option value="DATE_ASC">Vade / Kayıt Tarihine Göre</option>
          </select>
        </div>

        {/* Tür Filtre Butonları */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedType("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedType === "ALL"
                ? "bg-emerald-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-white bg-white/5"
            }`}
          >
            Tümü ({debts.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedType("TAKSITLI_KREDI")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedType === "TAKSITLI_KREDI"
                ? "bg-emerald-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-white bg-white/5"
            }`}
          >
            Krediler
          </button>
          <button
            type="button"
            onClick={() => setSelectedType("KREDI_KARTI")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedType === "KREDI_KARTI"
                ? "bg-emerald-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-white bg-white/5"
            }`}
          >
            Kredi Kartları
          </button>
          <button
            type="button"
            onClick={() => setSelectedType("EK_HESAP_KMH")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedType === "EK_HESAP_KMH"
                ? "bg-emerald-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-white bg-white/5"
            }`}
          >
            KMH / Ek Hesap
          </button>
          <button
            type="button"
            onClick={() => setSelectedType("ALTIN_BORCU")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedType === "ALTIN_BORCU"
                ? "bg-emerald-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-white bg-white/5"
            }`}
          >
            Altın Borçları
          </button>
          <button
            type="button"
            onClick={() => setSelectedType("KISI_BORCU")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedType === "KISI_BORCU"
                ? "bg-emerald-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-white bg-white/5"
            }`}
          >
            Kişi Borçları
          </button>
          <button
            type="button"
            onClick={() => setSelectedType("SENET_CEK")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedType === "SENET_CEK"
                ? "bg-emerald-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-white bg-white/5"
            }`}
          >
            Senet / Çek
          </button>
        </div>
      </div>

      {/* Borç Kartları Listesi */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto" />
          <p className="text-xs text-zinc-500">Borçlar listeleniyor...</p>
        </div>
      ) : filteredDebts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center glass-card">
          <CreditCard size={48} className="mx-auto text-zinc-600 mb-3" />
          <h3 className="text-base font-semibold text-zinc-200">
            {search || selectedType !== "ALL"
              ? "Kriterlere Uygun Borç Bulunamadı"
              : "Henüz Kayıtlı Borcunuz Yok"}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-6">
            Taksitli kredilerinizi, kart ekstrelerinizi, altın ve KMH borçlarınızı tek yerden takip edin.
          </p>
          <Link
            href="/debts/new"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-bold text-zinc-950 shadow-md hover:brightness-110 transition-colors"
          >
            <PlusCircle size={18} weight="bold" />
            <span>İlk Borcunuzu Ekleyin</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDebts.map((debt) => {
            const Icon = getDebtIcon(debt.type);
            const isLoan = debt.type === "TAKSITLI_KREDI";
            const amount = getDebtAmount(debt);
            const totalInst = debt.installmentCount || debt.installmentSchedules?.length || 0;
            const paidInst = debt.paidInstallments || 0;
            const progress = totalInst > 0 ? (paidInst / totalInst) * 100 : 0;

            const nextPendingSchedule = debt.installmentSchedules?.find(
              (s: any) => s.status !== "ODENDI"
            );

            return (
              <SwipeableCard
                key={debt.id}
                onSwipeRight={() => {
                  triggerHaptic("selection");
                  router.push(`/debts/${debt.id}`);
                }}
                onSwipeLeft={() => {
                  triggerHaptic("selection");
                  router.push(`/debts/${debt.id}`);
                }}
                rightActionLabel="Detay & Öde"
                leftActionLabel="Yönet"
              >
                <Link
                  href={`/debts/${debt.id}`}
                  onClick={() => triggerHaptic("selection")}
                  className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-900 border border-white/10 hover:border-emerald-500/40 transition-all duration-200 shadow-sm hover:shadow-[0_0_25px_rgba(16,185,129,0.1)] w-full block"
                >
                  <div>
                    {/* Kart Üst Başlık */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <InstitutionLogo
                            name={debt.institution?.name ?? debt.title}
                            color={debt.institution?.color ?? debt.color ?? null}
                            type={debt.institution?.type ?? "DIGER"}
                            size={42}
                          />
                          {valuations[debt.id]?.isOverdue && (
                            <span
                              aria-label="Gecikmiş"
                              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-zinc-900 bg-rose-500 text-[8px] font-bold text-white"
                            >
                              !
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                              <Icon size={11} weight="duotone" />
                              {TUR_ETIKETLERI[debt.type] ?? debt.type}
                            </span>
                            {debt.institution?.name && (
                              <span className="text-xs text-zinc-400 truncate">
                                {debt.institution.name}
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-white truncate mt-0.5 group-hover:text-emerald-400 transition-colors">
                            {debt.title}
                          </h3>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-bold text-white font-mono block">
                          {debt.type === "ALTIN_BORCU"
                            ? `${debt.quantity ? `${debt.quantity} Adet` : `${debt.grams} gr`}`
                            : formatCurrency(amount)}
                        </span>
                        <span className="text-[10px] text-zinc-500">Kalan Borç</span>
                      </div>
                    </div>

                    {/* İlerleme Çubuğu (Taksitli Borçlar için) */}
                    {isLoan && (
                      <div className="space-y-1.5 my-3">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-zinc-400">
                            {paidInst} / {totalInst} Taksit Ödendi
                          </span>
                          <span className="font-semibold text-emerald-400 font-mono">
                            %{progress.toFixed(0)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* KMH Özel Bildirimi */}
                    {debt.type === "EK_HESAP_KMH" && (
                      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] my-2">
                        <Lightning size={14} weight="fill" />
                        <span>Günlük işleyen faiz maliyeti aktif</span>
                      </div>
                    )}

                    {/* Altın Özel Marj Bildirimi */}
                    {debt.type === "ALTIN_BORCU" && debt.goldType === "ZINCIR_21_HALEP" && (
                      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-[11px] my-2">
                        <Coins size={14} weight="fill" />
                        <span>21 Ayar Halep zinciri (+200 TL/gr çarşı marjı dahil)</span>
                      </div>
                    )}
                  </div>

                  {/* Kart Alt Çubuk */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs text-zinc-400 mt-2">
                    <div className="flex items-center gap-2">
                      {isLoan && nextPendingSchedule ? (
                        <div className="flex items-center gap-1 text-[11px] text-zinc-300">
                          <Clock size={14} className="text-emerald-400" />
                          <span>Sıradaki: {formatDateTR(nextPendingSchedule.dueDate)}</span>
                          <span className="font-bold text-white font-mono ml-1">
                            ({formatCurrency(nextPendingSchedule.totalAmount)})
                          </span>
                        </div>
                      ) : debt.type === "KREDI_KARTI" ? (
                        <span className="text-[11px]">
                          Ödenecek:{" "}
                          <strong className="text-white font-mono">
                            {formatCurrency(
                              valuations[debt.id]?.outstandingTL ?? debt.currentStatementBalance ?? 0
                            )}
                          </strong>
                          {valuations[debt.id]?.nextDueDate
                            ? ` · ${new Date(valuations[debt.id]?.nextDueDate as string).toLocaleDateString("tr-TR")}`
                            : ""}
                        </span>
                      ) : debt.dueDate ? (
                        <span className="text-[11px]">Vade: {formatDateTR(debt.dueDate)}</span>
                      ) : (
                        <span className="text-[11px]">Süresiz</span>
                      )}
                    </div>

                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
                      <span>Detay</span>
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              </SwipeableCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
