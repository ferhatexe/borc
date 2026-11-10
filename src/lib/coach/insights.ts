import { formatCurrency, formatNumber } from "@/lib/formatters";
import type { DebtValuation, UpcomingPayment } from "@/lib/finance/debtValuation";
import type { StreakView } from "./streak";

/**
 * Ana sayfadaki bilgi kartları.
 *
 * Her kart kullanıcının kendi rakamlarından hesaplanan bir OLGUDUR: en yakın
 * taksit, işleyen faiz, en pahalı borç... Kartlar "şunu öde" demez; hangi
 * borcun ödeneceği kullanıcının kararıdır, kart o kararın önüne rakamı koyar.
 * Kural tabanlıdır, tahmin ya da uydurma rakam içermez.
 */
export interface Insight {
  id: string;
  /** urgent: bugün bakılmalı; warn: yaklaşıyor; info: bilgi; good: olumlu. */
  tone: "urgent" | "warn" | "info" | "good";
  title: string;
  /** Kartın büyük rakamı. */
  figure?: string;
  body: string;
  href?: string;
  linkLabel?: string;
}

export interface InsightInput {
  valuations: DebtValuation[];
  /** Önümüzdeki 60 günün ödemeleri + gecikmişler, vadeye göre sıralı. */
  upcoming: UpcomingPayment[];
  cashTL: number;
  totalDebtTL: number;
  bankDebtTL: number;
  goldDebtTL: number;
  dailyAccrualTL: number;
  accruedInterestTL: number;
  streak: StreakView | null;
}

const BANK_TYPES = new Set(["TAKSITLI_KREDI", "KREDI_KARTI", "EK_HESAP_KMH"]);
const tl = (n: number) => formatCurrency(n);

export function buildInsights(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const overdue = input.upcoming.filter((p) => p.isOverdue);
  const ahead = input.upcoming.filter((p) => !p.isOverdue);

  // 1) Gecikmiş ödemeler
  if (overdue.length > 0) {
    const total = overdue.reduce((s, p) => s + p.amountTL, 0);
    out.push({
      id: "overdue",
      tone: "urgent",
      title: `${overdue.length} ödemenin günü geçti`,
      figure: tl(total),
      body: "Gecikme faizi işliyor. Ödeyemeyeceğin bir taksit varsa bankayı arayıp erteleme ya da yapılandırma seçeneklerini sorabilirsin.",
      href: "/overdue",
      linkLabel: "Gecikenleri gör",
    });
  }

  // 2) En yakın ödeme
  const next = ahead[0];
  if (next) {
    const gun =
      next.daysUntilDue === 0 ? "Bugün" : next.daysUntilDue === 1 ? "Yarın" : `${next.daysUntilDue} gün sonra`;
    const karsilar = input.cashTL >= next.amountTL;
    out.push({
      id: "next-payment",
      tone: next.daysUntilDue <= 7 ? "warn" : "info",
      title: `${gun}: ${next.title}`,
      figure: tl(next.amountTL),
      body: karsilar
        ? `Kasadaki nakit (${tl(input.cashTL)}) bu taksiti karşılıyor.`
        : `Kasada bu taksiti karşılayacak nakit görünmüyor (kasa: ${tl(input.cashTL)}). Vadeden önce bankayla konuşmak, gecikmeye düşmekten daha fazla seçenek bırakır.`,
      href: `/debts/${next.debtId}`,
      linkLabel: "Borcu aç",
    });
  }

  // 3) Önümüzdeki 30 günün toplamı
  const in30 = ahead.filter((p) => p.daysUntilDue <= 30);
  if (in30.length > 1) {
    const total = in30.reduce((s, p) => s + p.amountTL, 0);
    const fark = input.cashTL - total;
    out.push({
      id: "next-30",
      tone: fark < 0 ? "warn" : "info",
      title: `30 günde ${in30.length} ödeme var`,
      figure: tl(total),
      body:
        fark < 0
          ? `Kasa ${tl(input.cashTL)}; bu ödemeler için ${tl(-fark)} eksik.`
          : `Kasa ${tl(input.cashTL)}; ödemelerden sonra ${tl(fark)} kalır.`,
      href: "/calendar",
      linkLabel: "Takvimi aç",
    });
  }

  // 4) Kumara giden para
  if (input.streak && input.streak.lostLast30DaysTL > 0) {
    const lost = input.streak.lostLast30DaysTL;
    const gunFaiz = input.dailyAccrualTL > 0 ? Math.round(lost / input.dailyAccrualTL) : 0;
    out.push({
      id: "gamble-cost",
      tone: "warn",
      title: "Son 30 günde kumara giden",
      figure: tl(lost),
      body:
        gunFaiz > 0
          ? `Bu para, bütün banka borçlarının ${formatNumber(gunFaiz)} günlük faizine eşit.`
          : "Bu para borçlardan düşebilirdi.",
    });
  }

  // 5) Her gün işleyen faiz
  if (input.dailyAccrualTL > 0) {
    out.push({
      id: "daily-interest",
      tone: "info",
      title: "Her gün işleyen faiz",
      figure: tl(input.dailyAccrualTL),
      body: `Ayda yaklaşık ${tl(input.dailyAccrualTL * 30)}. Son ödemelerden bugüne birikmiş, henüz ödenmemiş faiz: ${tl(input.accruedInterestTL)}.`,
    });
  }

  const bank = input.valuations.filter((v) => BANK_TYPES.has(v.type) && v.outstandingTL > 0);

  // 6) En yüksek faizli borç
  const pricey = bank
    .filter((v) => (v.monthlyInterestRatePercent ?? 0) > 0)
    .sort((a, b) => (b.monthlyInterestRatePercent ?? 0) - (a.monthlyInterestRatePercent ?? 0))[0];
  if (pricey && bank.length > 1) {
    out.push({
      id: "highest-rate",
      tone: "info",
      title: `En yüksek faizli borç: ${pricey.title}`,
      figure: `%${formatNumber(pricey.monthlyInterestRatePercent ?? 0, 2)} / ay`,
      body: `Günde ${tl(pricey.dailyAccrualTL)} faiz işletiyor. Bugünkü kapama tutarı ${tl(pricey.outstandingTL)}.`,
      href: `/debts/${pricey.id}`,
      linkLabel: "Borcu aç",
    });
  }

  // 7) En küçük borç
  const smallest = [...bank].sort((a, b) => a.outstandingTL - b.outstandingTL)[0];
  if (smallest && bank.length > 1 && smallest.id !== pricey?.id) {
    const kalan = smallest.remainingInstallments ?? 0;
    out.push({
      id: "smallest",
      tone: "info",
      title: `En küçük borç: ${smallest.title}`,
      figure: tl(smallest.outstandingTL),
      body:
        kalan > 0 && smallest.installmentAmountTL
          ? `Bugünkü kapama tutarı bu. Kapanırsa ${kalan} taksit (aylık ${tl(smallest.installmentAmountTL)}) biter.`
          : "Bugünkü kapama tutarı bu.",
      href: `/debts/${smallest.id}`,
      linkLabel: "Borcu aç",
    });
  }

  // 8) Altının payı
  if (input.goldDebtTL > 0 && input.totalDebtTL > 0) {
    const pay = (input.goldDebtTL / input.totalDebtTL) * 100;
    out.push({
      id: "gold-share",
      tone: "info",
      title: "Borcun altına bağlı kısmı",
      figure: `%${formatNumber(pay, 0)}`,
      body: `Altın borcuna faiz işlemez ama fiyatla değişir: altın %1 artarsa borç yaklaşık ${tl(input.goldDebtTL * 0.01)} artar, %1 düşerse o kadar azalır.`,
    });
  }

  return out;
}
