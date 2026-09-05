"use client";

import { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bank,
  Calendar,
  CheckCircle,
  Clock,
  Coins,
  CreditCard,
  CurrencyCircleDollar,
  DotsThreeCircle,
  Lightning,
  PiggyBank,
  PlusCircle,
  Repeat,
  Scroll,
  Trash,
  UsersThree,
  Vault,
  ShieldWarning,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Decimal from "decimal.js";
import { toast } from "sonner";
import { formatCurrency, formatDateTR } from "@/lib/formatters";
import { triggerHaptic } from "@/lib/haptics";
import { calculateEarlyPayoff } from "@/lib/finance/earlyPayoff";
import { useAppSettings } from "@/lib/hooks/useAppSettings";
import type { DebtValuation } from "@/lib/finance/debtValuation";

interface DebtDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function DebtDetailPage({ params }: DebtDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { settings } = useAppSettings();

  const [debt, setDebt] = useState<any>(null);
  // Balances, accrued interest and gold valuation are computed on the server so
  // every screen shows the same number.
  const [valuation, setValuation] = useState<DebtValuation | null>(null);
  const [goldWarning, setGoldWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ödeme Modalı State
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState("HAVALE");
  const [payNote, setPayNote] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  // Silme Modalı State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Erken Kapama Simülatörü State (oran yüzde olarak tutulur)
  const [penaltyPercent, setPenaltyPercent] = useState<number>(2);

  // Varsayılan komisyon oranı Ayarlar'dan gelir.
  useEffect(() => {
    setPenaltyPercent(Number((settings.taxRates.earlyPayoffPenaltyRate * 100).toFixed(2)));
  }, [settings.taxRates.earlyPayoffPenaltyRate]);

  const fetchDebt = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/debts/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Borç kaydı bulunamadı");

      setDebt(data.debt);
      setValuation(data.valuation ?? null);
      setGoldWarning(data.goldWarning ?? null);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Borç yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebt();
  }, [id]);

  // Taksit Ödeme İşlemi
  const handleOpenPayModal = (inst: any) => {
    triggerHaptic("selection");
    setSelectedInstallment(inst);
    setPayAmount(Number(inst.totalAmount));
    setPayNote(`${inst.installmentNo}. taksit ödemesi`);
  };

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment || isPaying) return;

    setIsPaying(true);
    try {
      const res = await fetch(`/api/debts/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentId: selectedInstallment.id,
          amount: payAmount,
          method: payMethod,
          note: payNote,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ödeme yapılamadı");
      }

      const result = await res.json();
      triggerHaptic("success");
      toast.success(
        result.expense
          ? "Ödeme kaydedildi ve gider kaydı oluşturuldu."
          : "Ödeme kaydedildi."
      );
      setSelectedInstallment(null);
      await fetchDebt();
      router.refresh();
    } catch (err: any) {
      triggerHaptic("error");
      toast.error(err.message || "Ödeme sırasında hata oluştu");
    } finally {
      setIsPaying(false);
    }
  };

  /**
   * Soft delete by default (şartname §11). Permanent removal needs a second,
   * explicit confirmation that the API also enforces.
   */
  const handleDeleteDebt = async (permanent = false) => {
    setIsDeleting(true);
    try {
      const query = permanent ? "?permanent=true&confirm=KALICI_SIL" : "";
      const res = await fetch(`/api/debts/${id}${query}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Borç silinemedi");

      triggerHaptic("success");
      toast.success(data.message);
      router.push("/debts");
      router.refresh();
    } catch (err: any) {
      triggerHaptic("error");
      toast.error(err.message || "Silinemedi");
      setIsDeleting(false);
    }
  };

  // Erken Kapama Hesaplaması (TAKSITLI_KREDI için)
  const earlyPayoff = useMemo(() => {
    if (!debt || debt.type !== "TAKSITLI_KREDI" || !debt.installmentSchedules?.length) {
      return null;
    }

    const schedules = debt.installmentSchedules;
    // Plandan turetilir; paidInstallments sayaci ile plan arasinda fark olursa
    // dogru olan plandir.
    const paidCount = schedules.filter((s: any) => s.status === "ODENDI").length;
    const pendingSchedules = schedules.filter((s: any) => s.status !== "ODENDI");

    if (pendingSchedules.length === 0) return null;

    // Kalan anapara
    const firstPending = pendingSchedules[0];
    const remainingPrincipal = new Decimal(firstPending.remainingPrincipal).plus(
      firstPending.principalPart
    );

    const formattedSchedule = schedules.map((s: any) => ({
      installmentNo: s.installmentNo,
      dueDate: new Date(s.dueDate),
      totalPayment: new Decimal(s.totalAmount),
      principalPayment: new Decimal(s.principalPart),
      interestPayment: new Decimal(s.interestPart),
      kkdfPayment: new Decimal(0),
      bsmvPayment: new Decimal(0),
      remainingPrincipal: new Decimal(s.remainingPrincipal),
    }));

    return calculateEarlyPayoff({
      // Kalan anapara sunucunun degerlemesinden gelir; ekrandaki "Kalan
      // Anapara" karti ile ayni rakam olmasi icin sart.
      remainingPrincipal: valuation?.principalTL ?? remainingPrincipal,
      amortizationSchedule: formattedSchedule,
      paidInstallmentCount: paidCount,
      // Slider yüzde gösterir, motor oranı kesir olarak bekler.
      penaltyRate: penaltyPercent / 100,
    });
  }, [debt, penaltyPercent, valuation]);

  /**
   * KMH accrual comes from the server, which anchors it to the account's
   * `lastInterestChargeDate` instead of assuming a single day at an invented
   * %5 rate.
   */
  const kmhAccrual = useMemo(() => {
    if (!valuation || valuation.type !== "EK_HESAP_KMH") return null;
    return {
      accruedTL: valuation.accruedInterestTL,
      dailyTL: valuation.dailyAccrualTL,
      monthlyTL: valuation.dailyAccrualTL * 30,
      days: valuation.overdraftDetail?.accrualDays ?? 0,
      lastChargeDate: valuation.overdraftDetail?.lastInterestChargeDate ?? null,
      payoffTL: valuation.outstandingTL,
    };
  }, [valuation]);

  // Altın değerlemesi sunucudan gelir (kullanıcının marj ve milyem ayarlarıyla).
  const [goldSource, setGoldSource] = useState<string>("");
  const [isRefreshingGold, setIsRefreshingGold] = useState(false);

  const refreshGoldPrices = async () => {
    setIsRefreshingGold(true);
    try {
      const res = await fetch("/api/gold", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fiyatlar yenilenemedi");
      setGoldSource(data.source);
      triggerHaptic("success");
      await fetchDebt();
    } catch (e: any) {
      triggerHaptic("error");
      toast.error(e.message || "Altın kurları alınamadı");
    } finally {
      setIsRefreshingGold(false);
    }
  };

  const goldValuation = useMemo(() => {
    if (!valuation || valuation.type !== "ALTIN_BORCU" || !valuation.goldDetail) return null;
    return {
      totalTL: valuation.outstandingTL,
      unitPriceWithPremiumTL: valuation.goldDetail.unitPriceWithPremiumTL,
      goldName: valuation.goldDetail.goldName,
      isPiece: valuation.goldDetail.isPiece,
    };
  }, [valuation]);

  // Grafik Verisi
  const chartData = useMemo(() => {
    if (!debt?.installmentSchedules?.length) return [];
    return debt.installmentSchedules.map((s: any) => ({
      name: `T${s.installmentNo}`,
      kalan: Number(s.remainingPrincipal),
      taksit: Number(s.totalAmount),
      anapara: Number(s.principalPart),
      faiz: Number(s.interestPart),
    }));
  }, [debt]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto" />
          <p className="text-xs text-zinc-500">Borç detayları yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !debt) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <ShieldWarning size={48} className="mx-auto text-rose-500" />
        <h2 className="text-lg font-bold text-white">Borç Bulunamadı</h2>
        <p className="text-xs text-zinc-400">{error || "Kayıt silinmiş veya erişilemiyor olabilir."}</p>
        <Link
          href="/debts"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
        >
          Borçlar Listesine Dön
        </Link>
      </div>
    );
  }

  const isLoan = debt.type === "TAKSITLI_KREDI";
  const totalInstallments = debt.installmentCount || debt.installmentSchedules?.length || 0;
  const paidInstallments = debt.paidInstallments || 0;
  const progressPercent =
    totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Üst Başlık & Eylemler */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/debts"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center font-bold text-white shadow-md text-sm"
              style={{ backgroundColor: debt.institution?.color || debt.color || "#10b981" }}
            >
              {debt.institution?.name
                ? debt.institution.name.substring(0, 2).toUpperCase()
                : debt.type.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/20">
                  {debt.type.replace(/_/g, " ")}
                </span>
                {debt.institution?.name && (
                  <span className="text-xs text-zinc-400 font-medium">
                    {debt.institution.name}
                  </span>
                )}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    debt.status === "KAPANDI"
                      ? "bg-zinc-800 text-zinc-400"
                      : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  {debt.status || "AKTIF"}
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white mt-0.5">{debt.title}</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-colors"
          >
            <Trash size={16} />
            <span>Arşivle / Sil</span>
          </button>
        </div>
      </div>

      {/* Ana Özet Metrikleri */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">
            {isLoan ? "Kalan Anapara" : debt.type === "ALTIN_BORCU" ? "Miktar" : "Kalan Borç"}
          </p>
          <p className="text-lg font-bold text-white font-mono">
            {isLoan
              ? // Sunucunun hesapladigi bakiye: bekleyen ilk taksitin kalan
                // anaparasi + o taksitin anapara payi. Sadece remainingPrincipal
                // kullanmak bir taksitlik anaparayi eksik gosteriyordu.
                formatCurrency(valuation?.principalTL ?? 0)
              : debt.type === "ALTIN_BORCU"
              ? (goldValuation ? formatCurrency(goldValuation.totalTL) : `${debt.quantity ? `${debt.quantity} Adet` : `${debt.grams} gr`}`)
              : debt.type === "EK_HESAP_KMH"
              ? formatCurrency(debt.usedAmount || 0)
              : debt.type === "KREDI_KARTI"
              ? formatCurrency(debt.currentStatementBalance || 0)
              : formatCurrency(debt.amount || 0)}
          </p>
          <p className="text-[10px] text-zinc-500">
            {isLoan
              ? `Toplam Kredi: ${formatCurrency(debt.principal || 0)}`
              : debt.type === "EK_HESAP_KMH"
              ? `Limit: ${formatCurrency(debt.limit || 0)}`
              : debt.type === "ALTIN_BORCU"
              ? (debt.quantity ? `${debt.quantity} Adet ${goldValuation?.goldName || ""}` : `${debt.grams} gr ${goldValuation?.goldName || ""}`)
              : "Toplam Borç"}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">
            {isLoan ? "Aylık Taksit" : debt.type === "KREDI_KARTI" ? "Asgari Ödeme" : "Vade / Durum"}
          </p>
          <p className="text-lg font-bold text-emerald-400 font-mono">
            {isLoan
              ? formatCurrency(debt.installmentAmount || 0)
              : debt.type === "KREDI_KARTI"
              ? formatCurrency(debt.minimumPayment || 0)
              : debt.dueDate
              ? formatDateTR(debt.dueDate)
              : "Süresiz"}
          </p>
          <p className="text-[10px] text-zinc-500">
            {isLoan
              ? `Ödeme Günü: Ayın ${debt.paymentDayOfMonth || 15}. günü`
              : debt.type === "KREDI_KARTI"
              ? `Son Gün: Ayın ${debt.dueDay}. günü`
              : "Vade Tarihi"}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Aylık Faiz Oranı</p>
          <p className="text-lg font-bold text-amber-400 font-mono">
            %{Number(debt.interestRateMonthly || debt.contractualInterestMonthly || 0).toFixed(2)}
          </p>
          <p className="text-[10px] text-zinc-500">
            {isLoan ? "KKDF & BSMV Dahil" : "Akdi Faiz"}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
          <p className="text-[11px] text-zinc-400">Ödeme İlerlemesi</p>
          <p className="text-lg font-bold text-teal-400 font-mono">
            {isLoan ? `${paidInstallments} / ${totalInstallments}` : `%${progressPercent.toFixed(0)}`}
          </p>
          <p className="text-[10px] text-zinc-500">
            {isLoan ? `%${progressPercent.toFixed(1)} tamamlandı` : "Genel durum"}
          </p>
        </div>
      </div>

      {/* İlerleme Çubuğu (Taksitli Borçlar için) */}
      {isLoan && (
        <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Kredi Geri Ödeme Seyri</span>
            <span className="font-semibold text-emerald-400">%{progressPercent.toFixed(1)}</span>
          </div>
          <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-500">
            <span>{paidInstallments} Taksit Ödendi</span>
            <span>{totalInstallments - paidInstallments} Taksit Kaldı</span>
          </div>
        </div>
      )}

      {/* Erken Kapama Simülatörü (TAKSITLI_KREDI için özel!) */}
      {earlyPayoff && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)] space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <PiggyBank size={22} weight="duotone" className="text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Erken Kapatma Simülatörü</h3>
                <p className="text-[11px] text-zinc-400">
                  Krediyi bugün toplu kapatırsanız ne kadar faiz tasarrufu sağlarsınız?
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-white/10 text-xs">
              <span className="text-zinc-400 text-[10px] pl-1.5">Ceza:</span>
              <button
                type="button"
                onClick={() => setPenaltyPercent(1)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  penaltyPercent === 1 ? "bg-emerald-500 text-zinc-950" : "text-zinc-400"
                }`}
              >
                %1 (&lt;36 ay)
              </button>
              <button
                type="button"
                onClick={() => setPenaltyPercent(2)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  penaltyPercent === 2 ? "bg-emerald-500 text-zinc-950" : "text-zinc-400"
                }`}
              >
                %2 (&gt;36 ay)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1">
              <p className="text-[11px] text-zinc-400">Bugün Kapatmak İçin Ödenecek</p>
              <p className="text-lg font-bold text-white font-mono">
                {formatCurrency(earlyPayoff.totalPayoffAmount)}
              </p>
              <p className="text-[10px] text-zinc-500">
                Kalan Anapara + {formatCurrency(earlyPayoff.penaltyFee)} Komisyon
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1">
              <p className="text-[11px] text-zinc-400">İptal Olacak Kalan Faizler</p>
              <p className="text-lg font-bold text-rose-400 font-mono">
                {formatCurrency(earlyPayoff.remainingScheduledInterest)}
              </p>
              <p className="text-[10px] text-zinc-500">Ödenmeyecek faiz ve vergiler</p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <p className="text-[11px] text-emerald-400 font-medium">Net Cebinizde Kalan Kazanç</p>
              <p className="text-xl font-bold text-emerald-400 font-mono">
                {formatCurrency(earlyPayoff.totalInterestSaved)}
              </p>
              <p className="text-[10px] text-emerald-500/80">Net Faiz Tasarrufu</p>
            </div>
          </div>
        </div>
      )}

      {/* KMH Günlük Tutan Canlı Gösterge */}
      {kmhAccrual && (
        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3">
          <div className="flex items-center gap-2">
            <Lightning size={20} weight="fill" className="text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              İşleyen Faiz
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-zinc-400">Şu ana kadar işleyen</p>
              <p className="text-base font-bold text-amber-400 font-mono tabular-nums">
                {formatCurrency(kmhAccrual.accruedTL)}
              </p>
              <p className="text-[10px] text-zinc-500">
                {kmhAccrual.days} gün
                {kmhAccrual.lastChargeDate &&
                  ` · ${formatDateTR(kmhAccrual.lastChargeDate)} tarihinden beri`}
              </p>
            </div>
            <div>
              <p className="text-zinc-400">Günlük faiz yükü</p>
              <p className="text-sm font-semibold text-amber-300 font-mono tabular-nums">
                {formatCurrency(kmhAccrual.dailyTL)} / gün
              </p>
            </div>
            <div>
              <p className="text-zinc-400">30 günlük maliyet</p>
              <p className="text-sm font-semibold text-rose-400 font-mono tabular-nums">
                ~{formatCurrency(kmhAccrual.monthlyTL)}
              </p>
            </div>
            <div>
              <p className="text-zinc-400">Bugün kapatılırsa</p>
              <p className="text-sm font-semibold text-white font-mono tabular-nums">
                {formatCurrency(kmhAccrual.payoffTL)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Altın Borcu Canlı Piyasa Değerleme Kartı */}
      {debt.type === "ALTIN_BORCU" && goldValuation && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-yellow-950/40 via-zinc-900 to-zinc-900 border border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)] space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Coins size={22} weight="duotone" className="text-yellow-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Canlı Kur Değerleme Kartı</h3>
                <p className="text-[11px] text-zinc-400">
                  {goldSource} kurları ile anlık serbest piyasa TL karşılığı
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isRefreshingGold}
              onClick={refreshGoldPrices}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              <ArrowsClockwise
                size={14}
                className={isRefreshingGold ? "animate-spin text-yellow-400" : ""}
              />
              <span>Kuru Güncelle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1">
              <p className="text-[11px] text-zinc-400">Kayıtlı Altın Miktarı</p>
              <p className="text-lg font-bold text-white font-mono">
                {debt.quantity ? `${debt.quantity} Adet` : `${debt.grams} Gram`}
              </p>
              <p className="text-[10px] text-zinc-500">
                {goldValuation.goldName} ({debt.karat || 22} Ayar)
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1">
              <p className="text-[11px] text-zinc-400">Uygulanan Birim Fiyat (Marj Dahil)</p>
              <p className="text-lg font-bold text-yellow-400 font-mono">
                {formatCurrency(goldValuation.unitPriceWithPremiumTL)}
              </p>
              <p className="text-[10px] text-zinc-500">
                {debt.goldType === "ZINCIR_21_HALEP"
                  ? "+200 TL/gr çarşı marjı dahil"
                  : debt.premiumTL
                  ? `+${debt.premiumTL} TL marj dahil`
                  : "Borsa/piyasa kuru"}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 space-y-1">
              <p className="text-[11px] text-yellow-400 font-medium">Toplam Canlı TL Borç</p>
              <p className="text-xl font-bold text-yellow-400 font-mono">
                {formatCurrency(goldValuation.totalTL)}
              </p>
              <p className="text-[10px] text-yellow-500/80">Güncel Serbest Piyasa Karşılığı</p>
            </div>
          </div>
        </div>
      )}

      {/* Amortisman Eritme Grafiği (Recharts) */}
      {chartData.length > 0 && (
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Amortisman ve Borç Eritme Grafiği
              </h3>
              <p className="text-[11px] text-zinc-400">Taksitler boyunca kalan anapara seyri</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Kalan Anapara
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-400" /> Faiz Payı
              </span>
            </div>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorKalan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorFaiz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#3f3f46",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                  formatter={(val: any) => formatCurrency(val)}
                />
                <Area
                  type="monotone"
                  dataKey="kalan"
                  name="Kalan Anapara"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorKalan)"
                />
                <Area
                  type="monotone"
                  dataKey="faiz"
                  name="Faiz + Vergi"
                  stroke="#f43f5e"
                  fillOpacity={1}
                  fill="url(#colorFaiz)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Amortisman Taksit Tablosu */}
      {debt.installmentSchedules && debt.installmentSchedules.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Taksit Ödeme Takvimi ({debt.installmentSchedules.length} Taksit)
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500">Tıklayarak Taksit Ödeyin</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-[11px] text-zinc-400 font-medium">
                  <th className="py-3 px-3">No</th>
                  <th className="py-3 px-3">Vade Tarihi</th>
                  <th className="py-3 px-3 text-right">Taksit Tutarı</th>
                  <th className="py-3 px-3 text-right">Anapara</th>
                  <th className="py-3 px-3 text-right">Faiz + Vergi</th>
                  <th className="py-3 px-3 text-right">Kalan Anapara</th>
                  <th className="py-3 px-3 text-center">Durum</th>
                  <th className="py-3 px-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {debt.installmentSchedules.map((s: any) => {
                  const isPaid = s.status === "ODENDI";
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isPaid ? "opacity-60 bg-emerald-950/10" : ""
                      }`}
                    >
                      <td className="py-3 px-3 text-zinc-400 font-bold">#{s.installmentNo}</td>
                      <td className="py-3 px-3 text-zinc-200 font-sans">
                        {formatDateTR(s.dueDate)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-400">
                        {formatCurrency(s.totalAmount)}
                      </td>
                      <td className="py-3 px-3 text-right text-zinc-300">
                        {formatCurrency(s.principalPart)}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-400">
                        {formatCurrency(s.interestPart)}
                      </td>
                      <td className="py-3 px-3 text-right text-zinc-400">
                        {formatCurrency(s.remainingPrincipal)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            <CheckCircle size={12} weight="bold" />
                            <span>Ödendi</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            <Clock size={12} />
                            <span>Bekliyor</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {!isPaid && (
                          <button
                            type="button"
                            onClick={() => handleOpenPayModal(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors shadow-sm cursor-pointer"
                          >
                            Öde
                          </button>
                        )}
                        {isPaid && (
                          <span className="text-[10px] text-zinc-500 font-sans">
                            {s.paidAt ? formatDateTR(s.paidAt) : "Ödendi"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ödeme Modalı */}
      {selectedInstallment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <CurrencyCircleDollar size={24} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Taksit Ödemesi Yap (#{selectedInstallment.installmentNo})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstallment(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleConfirmPay} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Ödenecek Tutar (₺) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full h-11 px-3.5 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white font-mono text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Ödeme Yöntemi
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full h-11 px-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="HAVALE">Havale / EFT / FAST</option>
                  <option value="OTOMATIK_ODEME">Otomatik Ödeme Talimatı</option>
                  <option value="KART">Banka / Kredi Kartı</option>
                  <option value="NAKIT">Elden Nakit</option>
                  <option value="DIGER">Diğer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Ödeme Notu</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Açıklama"
                  className="w-full h-10 px-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedInstallment(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-white/5"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isPaying || payAmount <= 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 disabled:opacity-50"
                >
                  {isPaying ? "İşleniyor..." : "Ödemeyi Onayla"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Silme Onay Modalı */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/20 bg-zinc-950 p-6 shadow-2xl space-y-4 text-center">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <Trash size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Borç Kaydını Sil?</h3>
              <p className="text-xs text-zinc-400 mt-1">
                &ldquo;{debt.title}&rdquo; kaydı ve taksit planı arşive kaldırılacaktır.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-white/5"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteDebt(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 disabled:opacity-50"
              >
                {isDeleting ? "İşleniyor..." : "Arşive kaldır"}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  if (
                    window.confirm(
                      "Bu borç, taksit planı ve ödeme geçmişi kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?"
                    )
                  ) {
                    handleDeleteDebt(true);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                Kalıcı sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
