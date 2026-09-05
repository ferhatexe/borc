"use client";

import { useState, useEffect } from "react";
import {
  ChartBar,
  ChartLine,
  ChartPieSlice,
  DownloadSimple,
  FileCsv,
  FileCode,
  Bank,
  CreditCard,
  Coins,
  ArrowDown,
  ArrowUp,
  Sparkle,
  ArrowsClockwise,
  CheckCircle,
} from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { triggerHaptic } from "@/lib/haptics";
import { DebtTrajectoryChart } from "@/components/dashboard/DebtTrajectoryChart";
import { ExpenseCategoryDonut } from "@/components/dashboard/ExpenseCategoryDonut";
import { ScenarioSimulatorCard } from "@/components/dashboard/ScenarioSimulatorCard";

export default function ReportsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "scenarios" | "exports">("overview");

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      const [resAnalytics, resDebts] = await Promise.all([
        fetch("/api/reports/analytics"),
        fetch("/api/debts"),
      ]);

      if (resAnalytics.ok) {
        const data = await resAnalytics.json();
        setAnalytics(data);
      }
      if (resDebts.ok) {
        const debts = await resDebts.json();
        setLoans(debts.filter((d: any) => d.type === "TAKSITLI_KREDI"));
      }
    } catch (err) {
      console.error("Rapor verisi yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, []);

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
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-900 border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setActiveTab("overview");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "scenarios"
                ? "bg-emerald-500 text-zinc-950 shadow-sm font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Senaryo Simülatörü
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setActiveTab("exports");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "exports"
                ? "bg-cyan-500 text-zinc-950 shadow-sm font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Dışa Aktar (CSV/Excel)
          </button>
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
          <span className="text-[10px] text-zinc-500 mt-1 block">Tüm gelir kaynakları</span>
        </div>

        <div className="glass-card p-5">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
            Bu Ay Toplam Gider
          </span>
          <p className="text-2xl font-extrabold text-rose-400 font-mono">
            -{formatCurrency(analytics?.totalMonthlyExpenseTL || 0)}
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">Harcama ve kart ödemeleri</span>
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
          </span>
        </div>
      </div>

      {/* SEKME 1: GENEL ANALİZ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Son 6 Aylık Gelir vs Gider Çift Sütun Grafiği */}
          {analytics?.cashFlowHistory && analytics.cashFlowHistory.length > 0 && (
            <div className="glass-card p-6 border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                    <ChartBar size={20} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Nakit Akışı Trendi (Son 6 Ay)</h3>
                    <p className="text-xs text-zinc-400">Aylık toplam gelir ve gider karşılaştırması</p>
                  </div>
                </div>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.cashFlowHistory}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="monthLabel" stroke="#71717a" fontSize={11} tickLine={false} />
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
                      formatter={(val: any, name: any) => [
                        formatCurrency(val),
                        name === "incomeTL" ? "Gelir" : "Gider",
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                      formatter={(value) => (value === "incomeTL" ? "Aylık Gelir" : "Aylık Gider")}
                    />
                    <Bar dataKey="incomeTL" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenseTL" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
                />
              </div>
            </div>
          )}

          {/* Borç Türleri Dağılımı ve Banka Dağılımı Tablosu */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            {/* Kurum / Banka Bazlı Borç Tablosu */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bank size={20} className="text-purple-400" />
                <span>Kurum / Banka Bazlı Kırılım</span>
              </h3>

              {analytics?.institutionBreakdown?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-zinc-500 border-b border-white/10 pb-2">
                        <th className="pb-2">Banka / Kurum</th>
                        <th className="pb-2 text-center">Aktif Borç</th>
                        <th className="pb-2 text-right">Kalan Tutar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {analytics.institutionBreakdown.map((inst: any) => (
                        <tr key={inst.institutionId} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 font-sans font-medium text-zinc-200">
                            {inst.institutionName}
                          </td>
                          <td className="py-2.5 text-center text-zinc-400">
                            {inst.debtCount} adet
                          </td>
                          <td className="py-2.5 text-right font-bold text-emerald-400">
                            {formatCurrency(inst.totalOutstandingTL)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-zinc-500">
                  Kayıtlı banka borcu bulunmuyor.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SEKME 2: SENARYO SİMÜLATÖRÜ */}
      {activeTab === "scenarios" && (
        <div className="space-y-6">
          {loans.length > 0 ? (
            <ScenarioSimulatorCard loans={loans} />
          ) : (
            <div className="glass-card p-12 text-center space-y-3">
              <Sparkle size={36} className="mx-auto text-emerald-500/50" />
              <h4 className="text-sm font-bold text-white">Simülasyon İçin Kredi Kaydı Gerekli</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Erken kapama veya aylık ek ödeme simülasyonunu çalıştırmak için en az 1 taksitli kredi kaydı bulunmalıdır.
              </p>
            </div>
          )}
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
