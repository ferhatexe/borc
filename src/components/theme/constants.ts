/** Eskiden kaydedilen tema tercihinin anahtarı; artık yalnız temizlenmek için. */
export const THEME_STORAGE_KEY = "borcolcme-theme";

export type Theme = "dark" | "light";

/** Uygulama yalnız açık temada çalışır. */
export const DEFAULT_THEME: Theme = "light";
