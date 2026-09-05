"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  TrendUp,
  TrendDown,
  Clock,
  CheckCircle,
  CreditCard,
  Bank,
  ArrowRight,
  Eye,
  PlusCircle,
} from "@phosphor-icons/react";
import { formatCurrency, formatDateTR } from "@/lib/formatters";
import { triggerHaptic } from "@/lib/haptics";
import { DayActivity, MonthCalendarData } from "@/lib/db/calendar";

export default function CalendarPage() {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [calendarData, setCalendarData] = useState<MonthCalendarData | null>(null);
  const [loading, setLoading] = useState(true);

  // Seçili Gün Detay Modalı
  const [selectedDay, setSelectedDay] = useState<DayActivity | null>(null);

  // Veri Çekme
  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/calendar?year=${currentYear}&month=${currentMonth}`);
      if (res.ok) {
        const data = await res.json();
        setCalendarData(data);
      }
    } catch (err) {
      console.error("Takvim verisi yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
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

  const handleGoToday = () => {
    triggerHaptic("selection");
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
  };

  // Takvim Izgarası Hesaplamaları (Pazartesi ilk gün)
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();
    // JS getDay(): 0 = Pazar, 1 = Pazartesi ... 6 = Cumartesi
    // Pazartesi'yi 0 yapmak için: (day + 6) % 7
    const startPadding = (firstDayIndex + 6) % 7;
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    return {
      startPadding,
      totalDaysInMonth,
    };
  }, [currentYear, currentMonth]);

  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  const weekDays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  return (
    <div className="space-y-6 pb-16">
      {/* Üst Başlık & Kontroller */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ödeme & Nakit Takvimi</h1>
          <p className="text-xs text-zinc-400">
            Aylık taksit vadeleri, beklenen gelir günleri ve nakit akış dengesi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGoToday}
            className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            Bugün
          </button>
          <div className="flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-xl p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <CaretLeft size={16} />
            </button>
            <span className="text-xs font-bold text-white px-2">
              {monthNames[currentMonth - 1]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <CaretRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Aylık Özet Şeridi */}
      {calendarData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <TrendUp size={14} className="text-emerald-400" />
              <span>Bu Ay Beklenen Gelir</span>
            </div>
            <p className="text-xl font-bold text-emerald-400 font-mono">
              +{formatCurrency(calendarData.totalInflow)}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <TrendDown size={14} className="text-rose-400" />
              <span>Toplam Borç / Harcama Yükü</span>
            </div>
            <p className="text-xl font-bold text-rose-400 font-mono">
              -{formatCurrency(calendarData.totalOutflow)}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
            <span className="text-[11px] text-zinc-400">Ay Sonu Net Nakit Dengesi</span>
            <p
              className={`text-xl font-bold font-mono ${
                calendarData.netCashFlow >= 0 ? "text-teal-400" : "text-amber-400"
              }`}
            >
              {calendarData.netCashFlow >= 0 ? "+" : ""}
              {formatCurrency(calendarData.netCashFlow)}
            </p>
          </div>
        </div>
      )}

      {/* Takvim Izgarası */}
      <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 glass-card space-y-2">
        {/* Gün Başlıkları */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-zinc-400 pb-2 border-b border-white/10">
          {weekDays.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Gün Hücreleri */}
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto" />
            <p className="text-xs text-zinc-500">Takvim yükleniyor...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {/* Boş Başlangıç Hücreleri */}
            {Array.from({ length: calendarGrid.startPadding }).map((_, idx) => (
              <div
                key={`pad-${idx}`}
                className="min-h-[85px] sm:min-h-[105px] rounded-xl bg-zinc-900/20 border border-white/[0.02] opacity-40"
              />
            ))}

            {/* Gün Hücreleri */}
            {Array.from({ length: calendarGrid.totalDaysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dayActivity = calendarData?.days[dayNum];
              const isToday =
                now.getFullYear() === currentYear &&
                now.getMonth() + 1 === currentMonth &&
                now.getDate() === dayNum;

              const events = dayActivity?.events || [];
              const hasEvents = events.length > 0;
              const netFlow = dayActivity?.net || 0;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => {
                    if (dayActivity) {
                      triggerHaptic("selection");
                      setSelectedDay(dayActivity);
                    }
                  }}
                  className={`relative flex flex-col justify-between p-1.5 sm:p-2 min-h-[85px] sm:min-h-[105px] rounded-xl border text-left transition-all ${
                    isToday
                      ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/40"
                      : hasEvents
                      ? "bg-zinc-900/80 border-white/10 hover:border-emerald-500/30 hover:bg-zinc-900"
                      : "bg-zinc-900/30 border-white/5 hover:bg-zinc-900/60"
                  }`}
                >
                  {/* Gün Numarası & Net Gösterge */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? "flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 font-mono"
                          : "text-zinc-300"
                      }`}
                    >
                      {dayNum}
                    </span>

                    {hasEvents && netFlow !== 0 && (
                      <span
                        className={`text-[9px] font-semibold font-mono hidden sm:inline ${
                          netFlow > 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {netFlow > 0 ? "+" : ""}
                        {(netFlow / 1000).toFixed(0)}k
                      </span>
                    )}
                  </div>

                  {/* Günlük Etkinlik Hapları / Rozetleri */}
                  <div className="space-y-1 w-full mt-1">
                    {events.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className={`px-1 py-0.5 rounded text-[9px] font-medium truncate flex items-center gap-1 ${
                          ev.type === "INCOME"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : ev.type === "DEBT_INSTALLMENT"
                            ? "bg-rose-500/20 text-rose-300"
                            : ev.type === "CREDIT_CARD_DUE"
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        <span className="font-bold truncate">{ev.title}</span>
                      </div>
                    ))}
                    {events.length > 2 && (
                      <span className="text-[9px] text-zinc-500 block text-right font-medium">
                        +{events.length - 2} daha
                      </span>
                    )}
                  </div>

                  {/* Boş gün tabanı */}
                  {!hasEvents && <div className="h-2" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Gün Detayı Modalı / Çekmecesi */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Modal Başlığı */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <CalendarBlank size={22} className="text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedDay.dayNumber} {monthNames[currentMonth - 1]} {currentYear} Detayı
                  </h3>
                  <p className="text-[11px] text-zinc-400">Günlük Nakit Akışı ve Vadeler</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Günün Nakit Özeti */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-zinc-900 border border-white/5 text-center">
              <div>
                <span className="text-[10px] text-zinc-400 block">Giriş</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  +{formatCurrency(selectedDay.inflow)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Çıkış / Borç</span>
                <span className="text-xs font-bold text-rose-400 font-mono">
                  -{formatCurrency(selectedDay.outflow)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Günlük Net</span>
                <span
                  className={`text-xs font-bold font-mono ${
                    selectedDay.net >= 0 ? "text-teal-400" : "text-amber-400"
                  }`}
                >
                  {selectedDay.net >= 0 ? "+" : ""}
                  {formatCurrency(selectedDay.net)}
                </span>
              </div>
            </div>

            {/* Günün Etkinlik Listesi */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                Günün Hareketleri ({selectedDay.events.length})
              </span>

              {selectedDay.events.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">
                  Bu gün için planlanmış bir ödeme veya gelir bulunmuyor.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDay.events.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0"
                          style={{ backgroundColor: ev.color || "#10b981" }}
                        >
                          {ev.type === "INCOME" ? (
                            <TrendUp size={16} />
                          ) : ev.type === "DEBT_INSTALLMENT" ? (
                            <Bank size={16} />
                          ) : (
                            <CreditCard size={16} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{ev.title}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                            <span>
                              {ev.type === "INCOME"
                                ? "Gelir"
                                : ev.type === "DEBT_INSTALLMENT"
                                ? "Kredi Taksiti"
                                : "Kart / Düzenli"}
                            </span>
                            {ev.status && (
                              <>
                                <span>•</span>
                                <span
                                  className={
                                    ev.status === "ODENDI" ? "text-emerald-400" : "text-amber-400"
                                  }
                                >
                                  {ev.status === "ODENDI" ? "Ödendi" : "Bekliyor"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-bold font-mono ${
                            ev.type === "INCOME" ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {ev.type === "INCOME" ? "+" : "-"}
                          {formatCurrency(ev.amount)}
                        </span>

                        {ev.debtId && (
                          <Link
                            href={`/debts/${ev.debtId}`}
                            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                          >
                            <ArrowRight size={14} />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hızlı Ekleme Butonları */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <Link
                href="/income"
                onClick={() => setSelectedDay(null)}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                <PlusCircle size={16} />
                <span>Gelir Ekle</span>
              </Link>

              <Link
                href="/expenses"
                onClick={() => setSelectedDay(null)}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300"
              >
                <PlusCircle size={16} />
                <span>Harcama Ekle</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
