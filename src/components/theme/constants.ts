/**
 * Tema anahtarı ayrı bir modülde durur.
 *
 * `ThemeScript` bir sunucu bileşeni, `ThemeProvider` ise `"use client"`.
 * Sabiti istemci modülünden içe aktarınca sunucu tarafında istemci referansı
 * geliyor ve değer `undefined` oluyordu: script `localStorage.getItem(undefined)`
 * çağırıp her yüklemede kaydedilmiş temayı ıskalıyordu.
 */
export const THEME_STORAGE_KEY = "borcolcme-theme";

export type Theme = "dark" | "light";
