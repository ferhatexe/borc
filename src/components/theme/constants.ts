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

/**
 * Uygulamanın ana teması açık.
 *
 * İşletim sistemi tercihi başlangıçta kasten dikkate alınmıyor: kullanıcıların
 * çoğunun sistemi koyu ve bu uygulamanın olması gereken görünümü açık. Kullanıcı
 * bir kez seçim yaparsa o seçim kalıcı olur ve her şeyin önüne geçer.
 */
export const DEFAULT_THEME: Theme = "light";
