"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChartBar,
  DownloadSimple,
  FileCsv,
  FileCode,
  CreditCard,
  ArrowDown,
  ArrowUp,
  } from "@phosphor-icons/react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { triggerHaptic } from "@/lib/haptics";
import { DebtTrajectoryChart } from "@/components/dashboard/DebtTrajectoryChart";
import { ExpenseCategoryDonut } from "@/components/dashboard/ExpenseCategoryDonut";
import { ScenarioSimulatorCard } from "@/components/dashboard/ScenarioSimulatorCard";
import { useChartTheme } from "@/lib/hooks/useChartTheme";
import { useLiveData } from "@/components/live/LiveDataProvider";
import { LiveDebtBreakdown } from "@/components/reports/LiveDebtBreakdown";

/**
 * Bir tutarın geçen aya göre durumu.
 *
 * Gelirde artış iyi, giderde kötü; renk `higherIsBetter` ile belirlenir.
 * Geçen ay sıfırsa yüzde hesaplanmaz, sadece "geçen ay kayıt yok" denir.
 */
function MonthComparison({
  changePercent,
  previousTL,
  higherIsBetter = false,
}: {
  changePercent?: number | null;
  previousTL?: number;
  higherIsBetter?: boolean;
}) {
  if (previousTL === undefined) return null;

  if (changePercent === null || changePercent === undefined) {
    return (
      <span className="mt-1 block text-[10px] text-zinc-500">
        {previousTL > 0
          ? `Geçen ay ${formatCurrency(previousTL)}`
          : "Geçen ay kayıt yok"}
      </span>
    );
  }

  const arttı = changePercent > 0;
  const iyi = higherIsBetter ? arttı : !arttı;
  const renk =
    Math.abs(changePercent) < 0.05
      ? "text-zinc-500"
      : iyi
        ? "text-emerald-400"
        : "text-rose-400";

  return (
    <span className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${renk}`}>
        {arttı ? <ArrowUp size={9} weight="bold" /> : <ArrowDown size={9} weight="bold" />}
        %{Math.abs(changePercent).toFixed(1)}
      </span>
      <span>geçen aya göre ({formatCurrency(previousTL)})</span>
    </span>
  );
}

export default function ReportsPage() {
  const chart = useChartTheme();
  const [analytics, setAnalytics] = useState<any>(null);
  /*
   * Raporlar tek seferlik bir çekimle geliyordu; altın ve kur hareket ettikçe
   * ekrandaki rakamlar sessizce eskiyordu. Paylaşılan canlı yoklama zaten 60
   * saniyede bir çalışıyor - analitik de her yoklamada tazeleniyor.
   */
  const live = useLiveData();
  const liveTotals = live?.data?.totals ?? null;
  const lastUpdatedAt = live?.lastUpdatedAt ?? null;
  const liveTotalDebtTL =
    (liveTotals?.totalDebtTL ?? analytics?.totalDebtTL ?? 0) + (live?.tickedInterestTL ?? 0);
  /*
   * Simülatör borcun ham kaydını değil, değerlemesini ister:
   * `remainingPrincipal`, `monthlyPayment`, `monthlyInterestRatePercent`.
   * Bu sayfa /api/debts'ten gelen ham satırları olduğu gibi veriyordu; o
   * satırlarda bu adlar yok, dolayısıyla simülatörün girdi listesi her zaman
   * boş kalıyor ve bileşen sessizce hiçbir şey çizmiyordu.
   *
   * Analitik zaten her borcun güncel anaparasını ve taksitini taşıyor; panelin
   * yaptığı eşleme burada da yapılıyor ve fazladan bir istek gerekmiyor.
   */
  const loans = useMemo(() => {
    const hepsi = (analytics?.institutionBreakdown ?? []).flatMap(
      (kurum: any) => kurum.debts ?? []
    );
    return hepsi
      .filter(
        (d: any) =>
          d.type === "TAKSITLI_KREDI" &&
          Number(d.principalTL) > 0 &&
          Number(d.installmentAmountTL ?? 0) > 0 &&
          Number(d.remainingInstallments ?? 0) > 0
      )
      .map((d: any) => ({
        id: d.id,
        title: d.title,
        remainingPrincipal: d.principalTL,
        monthlyPayment: d.installmentAmountTL ?? 0,
        monthlyInterestRatePercent: d.monthlyInterestRatePercent ?? 0,
        remainingMonths: d.remainingInstallments ?? 0,
      }));
  }, [analytics]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "scenarios" | "exports">("overview");

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      const resAnalytics = await fetch("/api/reports/analytics");
      if (resAnalytics.ok) {
        const data = await resAnalytics.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Rapor verisi yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
    // Canlı yoklama her tamamlandığında rapor da tazelensin.
     
  }, [lastUpdatedAt]);

  const handleDownload = (endpoint: string) => {
    triggerHaptic("selection");
    window.location.href = endpoint;
  };

  if (loading && !analytics) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto" />
          <p className="text-xs text-zinc-500">Finansal raporlar ve analitik hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  const netMonthly =
    (analytics?.totalMonthlyIncomeTL || 0) - (analytics?.totalMonthlyExpenseTL || 0);
  const previousNet =
    analytics?.previousMonthIncomeTL !== undefined
      ? analytics.previousMonthIncomeTL - analytics.previousMonthExpenseTL
      : null;

  return (
    <div className="space-y-8 pb-16">
      {/* Üst Başlık & Sekmeler */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Raporlar & Finansal Analiz
            <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Gelişmiş analitik grafikler, banka faiz dökümleri, senaryo simülasyonları ve Excel/CSV dışa aktarım
          </p>
        </div>

        {/* Tab Seçici */}
        {/*
          Uc sekim dar telefona sigmiyor (~390px). Serit kendi icinde yatay
          kayar; sayfa govdesi asla yatay kaymaz.
        */}
        <div className="-mx-3 max-w-full overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-1.5 p-1 rounded-2xl bg-zinc-900 border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setActiveTab("overview");
            }}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "overview"
                ? "bg-white/10 text-white shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Genel Analiz
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setActiveTab("scenarios");
            }}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "scenarios"
                ? "bg-emerald-500 text-zinc-950 shadow-sm font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span className="sm:hidden">Senaryo</span>
            <span className="hidden sm:inline">Senaryo Simülatörü</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setActiveTab("exports");
            }}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "exports"
                ? "bg-cyan-500 text-zinc-950 shadow-sm font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span className="sm:hidden">Dışa Aktar</span>
            <span className="hidden sm:inline">Dışa Aktar (CSV/Excel)</span>
          </button>
        </div>
        </div>
      </div>

      {/* 4 Özet Kart */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
            Toplam Borç Portföyü
          </span>
          <p className="text-2xl font-extrabold text-white font-mono">
            {formatCurrency(analytics?.totalDebtTL || 0)}
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">Kredi, kart, altın ve KMH</span>
        </div>

        <div className="glass-card p-5">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
            Bu Ay Toplam Gelir
          </span>
          <p className="text-2xl font-extrabold text-emerald-400 font-mono">
            +{formatCurrency(analytics?.totalMonthlyIncomeTL || 0)}
          </p>
          <MonthComparison
            changePercent={analytics?.incomeChangePercent}
            previousTL={analytics?.previousMonthIncomeTL}
            higherIsBetter
          />
        </div>

        <div className="glass-card p-5">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
            Bu Ay Toplam Gider
          </span>
          <p className="text-2xl font-extrabold text-rose-400 font-mono">
            -{formatCurrency(analytics?.totalMonthlyExpenseTL || 0)}
          </p>
          <MonthComparison
            changePercent={analytics?.expenseChangePercent}
            previousTL={analytics?.previousMonthExpenseTL}
          />
        </div>

        <div className="glass-card p-5">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
            Aylık Net Tasarruf
          </span>
          <p
            className={`text-2xl font-extrabold font-mono ${
              netMonthly >= 0 ? "text-cyan-400" : "text-rose-400"
            }`}
          >
            {formatCurrency(netMonthly)}
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">
            {netMonthly >= 0 ? "Pozitif nakit dengesi" : "Açık var, bütçe desteği gerekir"}
            {previousNet !== null && (
              <>
                {" · geçen ay "}
                <span className="font-mono">{formatCurrency(previousNet)}</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* SEKME 1: GENEL ANALİZ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Nakit akisi: ilk hareketten bugune, ve bilinen taksitlerle ileri */}
          {analytics?.cashFlowSeries && analytics.cashFlowSeries.length > 0 && (
            <div className="glass-card p-6 border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                    <ChartBar size={20} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Nakit Akışı</h3>
                    <p className="text-xs text-zinc-400">
                      İlk hareketinizden bugüne, ve önümüzdeki 6 ayın kesinleşmiş
                      taksitleri
                    </p>
                  </div>
                </div>
              </div>

              {/*
                Cok ay dar telefon ekranina sigmaz; grafik kendi icinde yatay
                kayar ve sutunlar okunakli kalir.
              */}
              <div className="-mx-2 overflow-x-auto px-2 pt-2">
                <div className="h-64 min-w-[34rem]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={analytics.cashFlowSeries}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                      <XAxis dataKey="monthLabel" stroke={chart.axis} fontSize={11} tickLine={false} />
                      <YAxis
                        stroke={chart.axis}
                        fontSize={10}
                        tickLine={false}
                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={chart.tooltipStyle}
                labelStyle={chart.tooltipLabelStyle}
                        formatter={(val: number | string, name: string) => [
                          formatCurrency(Number(val)),
                          name === "incomeTL" ? "Gelir" : name === "expenseTL" ? "Gider" : "Net",
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                        formatter={(value) =>
                          value === "incomeTL"
                            ? "Gelir"
                            : value === "expenseTL"
                              ? "Gider / planlı taksit"
                              : "Net"
                        }
                      />
                      {/* Sifir cizgisi: net cizgi altina dustugunde acik ay demektir. */}
                      <ReferenceLine y={0} stroke={chart.axis} strokeDasharray="2 2" />
                      {/*
                        Bugun ile gelecek arasindaki sinir. Sagindaki sutunlar
                        gerceklesmis harcama degil, plandan bilinen taksitler.
                      */}
                      {analytics.cashFlowSeries.some((m: any) => m.isFuture) && (
                        <ReferenceLine
                          x={
                            analytics.cashFlowSeries.find((m: any) => m.isFuture)
                              .monthLabel
                          }
                          stroke="#22d3ee"
                          strokeDasharray="4 4"
                          label={{
                            value: "bugünden sonrası",
                            position: "insideTopRight",
                            fill: "#22d3ee",
                            fontSize: 10,
                          }}
                        />
                      )}
                      {/*
                        Giris animasyonu kapali: ResponsiveContainer yatay kayan
                        bir kutunun icinde once dar olcup sonra genisliyor, ve
                        animasyon ilk olcumun koordinatlarini onbellege aliyor.
                        Sonuc: sutunlar 1198px'lik eksenin altinda 600px'lik bir
                        duzene gore diziliyor, yani aylarla hizalanmiyordu.
                      */}
                      <Bar
                        dataKey="incomeTL"
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="expenseTL"
                        fill="#f43f5e"
                        radius={[6, 6, 0, 0]}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="netTL"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: "#22d3ee" }}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <p className="px-1 text-[11px] leading-relaxed text-zinc-500">
                Kesikli çizginin solu gerçekleşen gelir ve giderleriniz, sağı ise
                taksit planlarınızdan bilinen ödemeler. Gelecek için gelir tahmini
                yapılmaz; yalnızca ödeyeceğiniz kesin olan tutarlar gösterilir.
              </p>
            </div>
          )}

          {/* 12 Aylık Borç Erime Projeksiyonu & Harcama Donut */}
          {analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <DebtTrajectoryChart
                  data={analytics.monthlyProjection12Months}
                  projectedDebtFreeDate={analytics.projectedDebtFreeDate}
                />
              </div>
              <div>
                <ExpenseCategoryDonut
                  categories={analytics.expenseCategoryBreakdown}
                  totalExpenseTL={analytics.totalMonthlyExpenseTL}
                  previousTotalTL={analytics.previousMonthExpenseTL}
                  totalChangePercent={analytics.expenseChangePercent}
                />
              </div>
            </div>
          )}

          {/* Borç türleri kırılımı */}
          <div className="grid grid-cols-1 gap-6">
            {/* Borç Türleri Kırılımı */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard size={20} className="text-emerald-400" />
                <span>Borç Türlerine Göre Dağılım</span>
              </h3>

              <div className="space-y-3">
                {analytics?.debtTypeBreakdown?.map((b: any) => (
                  <div key={b.type} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-300 font-medium">{b.label}</span>
                      <span className="font-mono text-white">
                        {formatCurrency(b.amountTL)} ({b.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${b.percentage}%`, backgroundColor: b.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/*
            Her borcun anlık dökümü. Kurum tablosu yalnızca adet ve toplam
            veriyordu; asıl istenen bir rakamın neden o kadar olduğunu görmek.
          */}
          <LiveDebtBreakdown
            institutions={analytics?.institutionBreakdown ?? []}
            totalDebtTL={liveTotalDebtTL}
            totalDailyAccrualTL={liveTotals?.dailyAccrualTL ?? 0}
            updatedAt={lastUpdatedAt}
          />
        </div>
      )}

      {/* SEKME 2: SENARYO SİMÜLATÖRÜ */}
      {activeTab === "scenarios" && (
        <div className="space-y-6">
          {/* Bos durumu bilesenin kendisi anlatiyor; burada ikinci bir kopya tutmak
              ikisinin ayrisma riskini getiriyordu. */}
          <ScenarioSimulatorCard loans={loans} />
        </div>
      )}

      {/* SEKME 3: DIŞA AKTAR (CSV / EXCEL & YEDEKLEME) */}
      {activeTab === "exports" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Borçlar Listesi CSV */}
            <div className="glass-card p-6 space-y-4 border-emerald-500/20 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <FileCsv size={24} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Tüm Borçlar & Krediler (CSV)</h3>
                    <span className="text-[10px] text-emerald-400 font-mono">Microsoft Excel Uyumlu</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400">
                  Tüm aktif borçlar, bankalar, anaparalar, faiz oranları ve vade bilgilerini içeren tablo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDownload("/api/reports/export?type=debts")}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <DownloadSimple size={16} weight="bold" />
                <span>Borçlar Tablosunu İndir (.csv)</span>
              </button>
            </div>

            {/* 2. Gelir & Gider Kayıtları CSV */}
            <div className="glass-card p-6 space-y-4 border-rose-500/20 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                    <FileCsv size={24} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Gelir & Gider Hareketleri (CSV)</h3>
                    <span className="text-[10px] text-rose-400 font-mono">Muhasebe & Ekstre Formatı</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400">
                  Tüm gelirler, market/fatura harcamaları, kategoriler ve ödeme yöntemlerini içeren döküm.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDownload("/api/reports/export?type=transactions")}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-zinc-950 text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-rose-500/20"
              >
                <DownloadSimple size={16} weight="bold" />
                <span>İşlem Geçmişini İndir (.csv)</span>
              </button>
            </div>

            {/* 3. Finansal Özet Bilanço CSV */}
            <div className="glass-card p-6 space-y-4 border-purple-500/20 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                    <ChartBar size={24} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Yıllık Finansal Özet Raporu</h3>
                    <span className="text-[10px] text-purple-400 font-mono">Kişisel Bilanço Özeti</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400">
                  Toplam borç, net nakit akışı, kategori ve borç türü oranlarını içeren yönetici raporu.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDownload("/api/reports/export?type=summary")}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-zinc-950 text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-purple-500/20"
              >
                <DownloadSimple size={16} weight="bold" />
                <span>Özet Raporu İndir (.csv)</span>
              </button>
            </div>

            {/* 4. Tam Veritabanı JSON Yedeği */}
            <div className="glass-card p-6 space-y-4 border-cyan-500/20 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                    <FileCode size={24} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Tam Veri Tabanı Yedeği (JSON)</h3>
                    <span className="text-[10px] text-cyan-400 font-mono">Taşınabilir Güvenli Arşiv</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400">
                  Tüm borçlar, taksitler, kategoriler ve işlemlerin ham JSON formatında eksiksiz yedeği.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDownload("/api/reports/backup")}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                <DownloadSimple size={16} weight="bold" />
                <span>JSON Yedek İndir (.json)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
