"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { THEME_STORAGE_KEY, type Theme } from "./constants";

export type { Theme };

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** `<html data-theme>` üzerinde okunur; sunucu ve istemci aynı değeri görür. */
function readAppliedTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/**
 * Koyu / açık tema.
 *
 * Seçim `localStorage`'da durur ve ilk boyamadan ÖNCE `ThemeScript` tarafından
 * `<html data-theme>` üzerine yazılır; yoksa açık temayı seçen kullanıcı her
 * yenilemede bir kare koyu ekran görürdü.
 *
 * Kullanıcı hiç seçim yapmadıysa işletim sisteminin tercihi kullanılır ve
 * sistem tercihi değiştikçe takip edilir - ta ki kullanıcı elle bir seçim
 * yapana kadar; ondan sonra kendi seçimi kazanır.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // İlk render'da script'in koyduğu değeri devral.
  useEffect(() => {
    setThemeState(readAppliedTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    // Tarayıcı arayüzü (adres çubuğu) de temaya uysun.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next === "light" ? "#f6f6f7" : "#0A0A0B");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Gizli sekmede depolama kapalı olabilir; tema yine de bu oturumda çalışır.
    }
  }, []);

  // Kullanıcı elle seçmediyse sistem tercihini izle.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        stored = null;
      }
      if (stored === "light" || stored === "dark") return;
      setThemeState(e.matches ? "light" : "dark");
      document.documentElement.setAttribute("data-theme", e.matches ? "light" : "dark");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme]
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Sağlayıcı yoksa koyu tema varsayılır; bileşen yine de çalışır. */
export function useTheme(): ThemeContextValue {
  return (
    useContext(ThemeContext) ?? {
      theme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
    }
  );
}
