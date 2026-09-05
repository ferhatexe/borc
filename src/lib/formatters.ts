import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import Decimal from "decimal.js";

/**
 * Para tutarını Türkçe formatta (1.234,56 ₺) döndürür.
 * Float duyarlık kaybını önlemek için Decimal.js uyumludur.
 */
export function formatCurrency(
  amount: number | string | Decimal | null | undefined,
  currency: "TRY" | "USD" | "EUR" | "XAU" | string = "TRY"
): string {
  if (amount === null || amount === undefined || amount === "") {
    return `0,00 ${currency === "TRY" ? "₺" : currency}`;
  }

  let dec: Decimal;
  try {
    dec = new Decimal(amount.toString());
  } catch {
    return `0,00 ${currency === "TRY" ? "₺" : currency}`;
  }

  const isNegative = dec.isNegative();
  const absDec = dec.abs();
  const parts = absDec.toFixed(2).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decPart = parts[1] || "00";

  const symbol =
    currency === "TRY"
      ? "₺"
      : currency === "USD"
      ? "$"
      : currency === "EUR"
      ? "€"
      : currency === "XAU"
      ? "Gr Altın"
      : currency;

  return `${isNegative ? "-" : ""}${intPart},${decPart} ${symbol}`;
}

/**
 * Sayıyı Türkçe binlik ayracıyla formatlar (örn: 1.234)
 */
export function formatNumber(
  value: number | string | Decimal | null | undefined,
  decimals = 0
): string {
  if (value === null || value === undefined || value === "") return "0";

  let dec: Decimal;
  try {
    dec = new Decimal(value.toString());
  } catch {
    return "0";
  }

  const isNegative = dec.isNegative();
  const absDec = dec.abs();
  const fixed = absDec.toFixed(decimals);
  const parts = fixed.split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (decimals > 0 && parts[1]) {
    return `${isNegative ? "-" : ""}${intPart},${parts[1]}`;
  }
  return `${isNegative ? "-" : ""}${intPart}`;
}

/**
 * Yüzde oranını Türkçe formatta gösterir (örn: %3,45)
 */
export function formatPercent(
  rate: number | string | Decimal | null | undefined
): string {
  if (rate === null || rate === undefined || rate === "") return "%0,00";

  try {
    const dec = new Decimal(rate.toString());
    const val = dec.toFixed(2).replace(".", ",");
    return `%${val}`;
  } catch {
    return "%0,00";
  }
}

/**
 * Tarihi Türkçe formatta döndürür (örn: 05.09.2026 veya 05 Eylül 2026)
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatPattern = "dd.MM.yyyy"
): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, formatPattern, { locale: tr });
  } catch {
    return "-";
  }
}

/**
 * Uzun tarih formatı (örn: 5 Eylül 2026, Cumartesi)
 */
export function formatDateLong(date: Date | string | null | undefined): string {
  return formatDate(date, "d MMMM yyyy, EEEE");
}

export const formatDateTR = formatDate;

/**
 * Canlı sayaçlar için ondalık hassasiyeti tutara göre seçer.
 *
 * Saniyede kuruşun altında artan bir değerde 4 hane şart; 1.842 TL gibi bir
 * tutarda ise "1.842,3100" gereksiz gürültü olur, 2 hane yeterlidir.
 */
export function formatLiveAmount(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return formatCurrency(0);
  return Math.abs(n) >= 100 ? formatCurrency(n) : `${formatNumber(n, 4)} ₺`;
}
