/**
 * Kumarsız gün serisi.
 *
 * Seri, son kumar oynanan günden bugüne geçen gün sayısıdır; kullanıcı her
 * gün "bugün oynamadım" diye işaretler (yoklama). Yoklamayı unutmak seriyi
 * BOZMAZ - bozan tek şey kullanıcının kendi bildirdiği bir oynama günüdür.
 * Duolingo'da kaçan gün seriyi sıfırlar; burada bu, dürüst bildirimi
 * cezalandırıp insanı uygulamadan soğuturdu.
 *
 * Tarihler "YYYY-AA-GG" metnidir ve İstanbul gününe göre tutulur; sunucu UTC
 * olsa da gece yarısı doğru günde döner.
 */

export interface Relapse {
  date: string;
  /** Kaybedilen tutar; kullanıcı girmediyse null. */
  amountTL: number | null;
}

export interface CoachState {
  /** Son kumar oynanan gün. Hiç kurulmadıysa null. */
  lastGambleDay: string | null;
  /** "Bugün oynamadım" işaretlenen günler. */
  checkins: string[];
  relapses: Relapse[];
  bestStreak: number;
}

export const EMPTY_COACH_STATE: CoachState = {
  lastGambleDay: null,
  checkins: [],
  relapses: [],
  bestStreak: 0,
};

export type DayStatus = "clean" | "relapse" | "pending" | "none";

export interface StreakView {
  isSetUp: boolean;
  /** Son oynanan günden bugüne geçen gün; kurulmadıysa 0. */
  days: number;
  bestStreak: number;
  checkedInToday: boolean;
  /** Bugünle biten son 7 gün, eskiden yeniye. */
  week: Array<{ date: string; status: DayStatus }>;
  totalLostTL: number;
  lostLast30DaysTL: number;
  /** Sıradaki kilometre taşı ve ona kalan gün. */
  nextMilestone: number;
  daysToMilestone: number;
}

const MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365];

/** Verilen anın İstanbul'daki takvim günü. */
export function istanbulDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const toUTC = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** b - a, gün olarak. */
export function dayDiff(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

export function addDays(day: string, n: number): string {
  return new Date(toUTC(day) + n * 86_400_000).toISOString().slice(0, 10);
}

export function isValidDay(day: unknown): day is string {
  return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(toUTC(day));
}

export function currentStreak(state: CoachState, today: string): number {
  if (!state.lastGambleDay) return 0;
  return Math.max(0, dayDiff(state.lastGambleDay, today));
}

export function buildStreakView(state: CoachState, today: string): StreakView {
  const days = currentStreak(state, today);
  const relapseDays = new Set(state.relapses.map((r) => r.date));
  if (state.lastGambleDay) relapseDays.add(state.lastGambleDay);
  const checkins = new Set(state.checkins);

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    let status: DayStatus = "none";
    if (relapseDays.has(date)) status = "relapse";
    else if (checkins.has(date)) status = "clean";
    else if (date === today) status = "pending";
    return { date, status };
  });

  const from30 = addDays(today, -30);
  const sum = (rows: Relapse[]) => rows.reduce((s, r) => s + (r.amountTL ?? 0), 0);
  const nextMilestone = MILESTONES.find((m) => m > days) ?? days + 30;

  return {
    isSetUp: state.lastGambleDay !== null,
    days,
    bestStreak: Math.max(state.bestStreak, days),
    checkedInToday: checkins.has(today),
    week,
    totalLostTL: sum(state.relapses),
    lostLast30DaysTL: sum(state.relapses.filter((r) => r.date > from30)),
    nextMilestone,
    daysToMilestone: nextMilestone - days,
  };
}

/** "Bugün oynamadım". Bugün zaten oynandı diye bildirildiyse işaretlenemez. */
export function checkIn(state: CoachState, today: string): CoachState {
  if (!state.lastGambleDay || state.lastGambleDay === today || state.checkins.includes(today)) {
    return state;
  }
  return {
    ...state,
    checkins: [...state.checkins, today].slice(-400),
    bestStreak: Math.max(state.bestStreak, currentStreak(state, today)),
  };
}

/**
 * Oynanan bir günü kaydeder (ilk kurulum da budur). Seri o günden yeniden
 * başlar; o güne ve sonrasına ait "oynamadım" işaretleri silinir, en iyi seri
 * korunur.
 */
export function recordGamble(
  state: CoachState,
  date: string,
  amountTL: number | null,
  today: string
): CoachState {
  if (dayDiff(date, today) < 0) return state; // gelecek tarih olmaz
  const best = Math.max(state.bestStreak, currentStreak(state, date));
  const isLater = !state.lastGambleDay || date >= state.lastGambleDay;
  const existing = state.relapses.find((r) => r.date === date);
  const relapses = existing
    ? state.relapses.map((r) =>
        r.date === date ? { date, amountTL: (r.amountTL ?? 0) + (amountTL ?? 0) || null } : r
      )
    : [...state.relapses, { date, amountTL }];

  return {
    lastGambleDay: isLater ? date : state.lastGambleDay,
    checkins: state.checkins.filter((d) => d < date),
    relapses: relapses.sort((a, b) => a.date.localeCompare(b.date)).slice(-400),
    bestStreak: best,
  };
}

/** Veritabanından gelen ham değeri güvenli bir duruma çevirir. */
export function normalizeCoachState(raw: unknown): CoachState {
  if (!raw || typeof raw !== "object") return EMPTY_COACH_STATE;
  const r = raw as Record<string, unknown>;
  return {
    lastGambleDay: isValidDay(r.lastGambleDay) ? r.lastGambleDay : null,
    checkins: Array.isArray(r.checkins) ? r.checkins.filter(isValidDay) : [],
    relapses: Array.isArray(r.relapses)
      ? r.relapses
          .filter((x): x is Relapse => !!x && typeof x === "object" && isValidDay((x as Relapse).date))
          .map((x) => ({
            date: x.date,
            amountTL: typeof x.amountTL === "number" && x.amountTL > 0 ? x.amountTL : null,
          }))
      : [],
    bestStreak: typeof r.bestStreak === "number" && r.bestStreak > 0 ? Math.floor(r.bestStreak) : 0,
  };
}
