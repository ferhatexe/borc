/**
 * Kredi kartı bakiyesini ekstre kesim gününe göre ikiye böler.
 *
 * Banka, kesim günü dahil o güne kadarki harcamaları o ekstreye yazar ve
 * ekstrenin son ödeme gününde ister. Kesimden sonraki harcamalar bir sonraki
 * ekstreye, yani bir sonraki son ödeme gününe kalır. Uygulama eskiden kartın
 * tüm bakiyesini en yakın son ödeme gününde gösteriyordu; kesimden sonraki
 * alışveriş de "bu ay ödenecek"e giriyordu.
 *
 * Bakiye tek bir sayı olarak tutulur (ekstre + sonradan girilen kart
 * harcamaları - ödemeler). Kesimden sonraki kısım, son kesimden sonra tarihli
 * kart harcamalarının toplamıdır; kalanı mevcut ekstredir. Ödemeler önce
 * ekstreden düşmüş sayılır.
 *
 * Günler İstanbul takvimiyle karşılaştırılır.
 */

export interface CardPurchase {
  date: Date | string;
  amount: number;
}

export interface CardSplit {
  /** Son ekstre kesim günü (İstanbul, öğlen UTC olarak). */
  lastCut: Date;
  /** Son ekstreden kalan ve `statementDue`'da istenecek tutar. */
  statementTL: number;
  statementDue: Date;
  /** Kesimden sonraki harcamalar; `nextDue`'da istenecek. */
  nextTL: number;
  nextDue: Date;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Anın İstanbul'daki takvim günü: [yıl, ay (1-12), gün]. */
function istanbulYmd(d: Date | string): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(d));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return [get("year"), get("month"), get("day")];
}

/** Ayın `day`. günü; ay kısaysa son günü. Öğlen UTC (uygulamanın tarih kuralı). */
function dayOfMonth(year: number, month: number, day: number): Date {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(day, last), 12));
}

/** "YYYY-MM-DD" (İstanbul); metin olarak sıralanabilir. */
function ymdKey(d: Date): string {
  const [y, m, day] = istanbulYmd(d);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Kesimden sonra gelen ilk son ödeme günü. Kesim ve son ödeme aynı günse
 * (kullanıcı ekstre tarihini ödeme günü olarak girmiş) ekstre o gün istenir:
 * 04.11-04.12 arası harcamalar 04.12'de ödenir, 04.01'e kaymaz.
 */
export function dueAfterCut(cut: Date, dueDay: number): Date {
  const [y, m] = istanbulYmd(cut);
  const sameMonth = dayOfMonth(y, m, dueDay);
  return ymdKey(sameMonth) >= ymdKey(cut) ? sameMonth : dayOfMonth(y, m + 1, dueDay);
}

export function splitCardBalance(params: {
  balance: number;
  statementDay: number;
  dueDay: number;
  purchases: CardPurchase[];
  now?: Date;
}): CardSplit {
  const { balance, statementDay, dueDay, purchases, now = new Date() } = params;
  const [y, m, d] = istanbulYmd(now);
  const lastCut = d >= statementDay ? dayOfMonth(y, m, statementDay) : dayOfMonth(y, m - 1, statementDay);
  const [cy, cm] = istanbulYmd(lastCut);
  const nextCut = dayOfMonth(cy, cm + 1, statementDay);

  const cutKey = ymdKey(lastCut);
  const afterCut = purchases
    .filter((p) => ymdKey(new Date(p.date)) > cutKey)
    .reduce((s, p) => s + p.amount, 0);

  const safeBalance = Math.max(0, balance);
  const nextTL = round2(Math.min(safeBalance, Math.max(0, afterCut)));
  return {
    lastCut,
    statementTL: round2(safeBalance - nextTL),
    statementDue: dueAfterCut(lastCut, dueDay),
    nextTL,
    nextDue: dueAfterCut(nextCut, dueDay),
  };
}
