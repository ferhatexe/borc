"use client";

import { useState, useMemo } from "react";
import { generateAmortizationSchedule } from "@/lib/finance/annuity";
import { formatCurrency, formatDateTR, parseDateInput } from "@/lib/formatters";
import {
  CheckCircle,
  Calendar,
  Sparkle,
  CaretDown,
  CaretUp,
  Bank,
  CreditCard,
  Vault,
  Coins,
  ShieldCheck,
} from "@phosphor-icons/react";

interface DebtSchedulePreviewProps {
  debtType: string;
  institution?: { name: string; color?: string | null } | null;
  formData: any;
  onConfirm: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

export function DebtSchedulePreview({
  debtType,
  institution,
  formData,
  onConfirm,
  onBack,
  isSubmitting = false,
}: DebtSchedulePreviewProps) {
  const [showAllInstallments, setShowAllInstallments] = useState(false);

  // Amortisman Takvimi Hesaplama (Taksitli Kredi ise)
  const schedule = useMemo(() => {
    if (
      debtType === "TAKSITLI_KREDI" &&
      formData.principal &&
      formData.installmentCount &&
      formData.interestRateMonthly !== undefined
    ) {
      try {
        // Identical arguments to the ones createDebt uses on the server, so the
        // plan previewed here is exactly the plan that gets saved.
        const rows = generateAmortizationSchedule({
          principal: formData.principal,
          monthlyInterestRatePercent: formData.interestRateMonthly,
          installmentCount: Number(formData.installmentCount),
          includeKKDF: formData.includeKKDF,
          kkdfRate: formData.kkdfRate,
          includeBSMV: formData.includeBSMV,
          bsmvRate: formData.bsmvRate,
          firstPaymentDate: parseDateInput(formData.firstPaymentDate) ?? new Date(),
          paymentDayOfMonth: formData.paymentDayOfMonth,
          installmentAmountOverride: formData.installmentAmount || null,
        });
        return rows;
      } catch (err) {
        console.error("Amortisman tablosu oluşturulamadı:", err);
        return [];
      }
    }
    return [];
  }, [debtType, formData]);

  const displayedRows = showAllInstallments ? schedule : schedule.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Üst Onay Kartı */}
      <div className="p-5 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)] space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-white shadow-md text-sm"
              style={{ backgroundColor: institution?.color || "#10b981" }}
            >
              {institution?.name ? institution.name.substring(0, 2).toUpperCase() : "BR"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                  {debtType.replace(/_/g, " ")}
                </span>
                {institution?.name && (
                  <span className="text-xs text-zinc-400 font-medium">{institution.name}</span>
                )}
              </div>
              <h3 className="text-lg font-bold text-white mt-0.5">{formData.title}</h3>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-zinc-400 block">Özet Tutar</span>
            <span className="text-xl font-bold text-emerald-400 font-mono">
              {debtType === "TAKSITLI_KREDI"
                ? formatCurrency(formData.principal)
                : debtType === "ALTIN_BORCU"
                ? `${formData.quantity ? `${formData.quantity} Adet` : `${formData.grams} gr`} Altın`
                : debtType === "EK_HESAP_KMH"
                ? formatCurrency(formData.usedAmount)
                : debtType === "KREDI_KARTI"
                ? formatCurrency(formData.currentStatementBalance)
                : formatCurrency(formData.amount || 0)}
            </span>
          </div>
        </div>

        {/* Detay Parametreleri */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/5 text-xs">
          {debtType === "TAKSITLI_KREDI" && (
            <>
              <div>
                <p className="text-zinc-500">Aylık Taksit</p>
                <p className="font-semibold text-white font-mono mt-0.5">
                  {formatCurrency(formData.installmentAmount)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Vade</p>
                <p className="font-semibold text-white mt-0.5">{formData.installmentCount} Ay</p>
              </div>
              <div>
                <p className="text-zinc-500">Aylık Faiz Oranı</p>
                <p className="font-semibold text-amber-400 font-mono mt-0.5">
                  %{Number(formData.interestRateMonthly).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">İlk Ödeme Tarihi</p>
                <p className="font-semibold text-white mt-0.5">
                  {formData.firstPaymentDate ? formatDateTR(formData.firstPaymentDate) : "-"}
                </p>
              </div>
            </>
          )}

          {debtType === "ALTIN_BORCU" && (
            <>
              <div>
                <p className="text-zinc-500">Altın Türü</p>
                <p className="font-semibold text-yellow-400 mt-0.5">{formData.goldType}</p>
              </div>
              <div>
                <p className="text-zinc-500">Marj / Fark</p>
                <p className="font-semibold text-white font-mono mt-0.5">
                  +{formData.premiumTL || 0} ₺
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Alacaklı</p>
                <p className="font-semibold text-white mt-0.5">{formData.creditorName}</p>
              </div>
              <div>
                <p className="text-zinc-500">Fiyat Modu</p>
                <p className="font-semibold text-emerald-400 mt-0.5">{formData.priceSource}</p>
              </div>
            </>
          )}

          {debtType === "EK_HESAP_KMH" && (
            <>
              <div>
                <p className="text-zinc-500">KMH Limiti</p>
                <p className="font-semibold text-white font-mono mt-0.5">
                  {formatCurrency(formData.limit)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Kullanılan Eksi Bakiye</p>
                <p className="font-semibold text-rose-400 font-mono mt-0.5">
                  {formatCurrency(formData.usedAmount)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Aylık Akdi Faiz</p>
                <p className="font-semibold text-amber-400 font-mono mt-0.5">
                  %{formData.interestRateMonthly}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Günlük Faiz</p>
                <p className="font-semibold text-emerald-400 mt-0.5">Aktif Tahakkuk</p>
              </div>
            </>
          )}

          {debtType === "KREDI_KARTI" && (
            <>
              <div>
                <p className="text-zinc-500">Kart Limiti</p>
                <p className="font-semibold text-white font-mono mt-0.5">
                  {formatCurrency(formData.creditLimit)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Asgari Ödeme</p>
                <p className="font-semibold text-amber-400 font-mono mt-0.5">
                  {formatCurrency(formData.minimumPayment)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Hesap Kesim</p>
                <p className="font-semibold text-white mt-0.5">Ayın {formData.statementDay}. Günü</p>
              </div>
              <div>
                <p className="text-zinc-500">Son Ödeme</p>
                <p className="font-semibold text-rose-400 mt-0.5">Ayın {formData.dueDay}. Günü</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Amortisman Planı Tablosu (TAKSITLI_KREDI ise) */}
      {schedule.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Hesaplanan Geri Ödeme & Taksit Planı ({schedule.length} Taksit)
              </h4>
            </div>
            <span className="text-[11px] text-zinc-500">Otomatik Amortisman</span>
          </div>

            {/*
              Kaydirma kutusu tek basina yetmiyor: `w-full` tabloyu kapsayicinin
              genisligine sikistirdigi icin sutunlar dar telefonda ust uste
              biniyordu. Asgari genislik verilince tablo sikismak yerine yatay
              kayiyor ve sutunlar hizasini koruyor.
            */}
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-900/60">
            <table className="w-full min-w-[40rem] text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-[11px] text-zinc-400 font-medium">
                  <th className="py-2.5 px-3">No</th>
                  <th className="py-2.5 px-3">Vade Tarihi</th>
                  <th className="py-2.5 px-3 text-right">Taksit Tutarı</th>
                  <th className="py-2.5 px-3 text-right">Anapara</th>
                  <th className="py-2.5 px-3 text-right">Faiz + Vergi</th>
                  <th className="py-2.5 px-3 text-right">Kalan Anapara</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {displayedRows.map((row) => (
                  <tr key={row.installmentNo} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 text-zinc-400">#{row.installmentNo}</td>
                    <td className="py-2.5 px-3 text-zinc-300 font-sans">
                      {formatDateTR(row.dueDate)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                      {formatCurrency(row.totalPayment)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-200">
                      {formatCurrency(row.principalPayment)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-400">
                      {formatCurrency(
                        row.interestPayment.plus(row.kkdfPayment).plus(row.bsmvPayment)
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-400">
                      {formatCurrency(row.remainingPrincipal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {schedule.length > 5 && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowAllInstallments(!showAllInstallments)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
              >
                {showAllInstallments ? (
                  <>
                    <CaretUp size={14} />
                    <span>İlk 5 Taksiti Göster</span>
                  </>
                ) : (
                  <>
                    <CaretDown size={14} />
                    <span>Tüm {schedule.length} Taksiti Göster</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Aksiyon Butonları */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
        >
          Geri Dön & Düzenle
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-zinc-950 shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:brightness-110 active:scale-98 transition-all disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Kaydediliyor...</span>
          ) : (
            <>
              <CheckCircle size={18} weight="bold" />
              <span>Borcu Veritabanına Kaydet</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
