/**
 * Kullanıcının yazdığı sayıyı çözer: "2435,50", "2435.50", "117.042,60",
 * "1.250.000" hepsi geçerli.
 *
 * Kural:
 *  - Virgül varsa ondalık ayırıcıdır, noktalar binlik ayırıcıdır.
 *  - Virgül yoksa: birden fazla nokta binliktir; tek nokta ondalıktır
 *    ("4.25" faiz oranı gibi).
 * Çözülemeyen ya da boş metin için null döner; uydurma 0 üretilmez.
 */
export function parseLocaleNumber(text: string): number | null {
  const t = text.trim().replace(/\s/g, "");
  if (!t) return null;

  let normalized: string;
  if (t.includes(",")) {
    normalized = t.replace(/\./g, "").replace(",", ".");
  } else if ((t.match(/\./g) ?? []).length > 1) {
    normalized = t.replace(/\./g, "");
  } else {
    normalized = t;
  }

  if (!/^-?\d*\.?\d*$/.test(normalized) || normalized === "" || normalized === "-" || normalized === ".") {
    return null;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Sayıyı alanda gösterilecek metne çevirir: ondalık virgülle, binlik ayırıcısız. */
export function numberToInputText(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return String(n).replace(".", ",");
}

/** Yazarken yalnızca rakam, virgül ve nokta kalır; tam sayı alanında ayırıcı da kalmaz. */
export function sanitizeNumberText(text: string, integer: boolean): string {
  const cleaned = text.replace(integer ? /[^\d]/g : /[^\d.,]/g, "");
  if (integer) return cleaned;
  // Birden fazla virgül yazılamaz.
  const firstComma = cleaned.indexOf(",");
  return firstComma === -1
    ? cleaned
    : cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, "");
}
