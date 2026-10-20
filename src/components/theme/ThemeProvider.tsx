"use client";

import { createContext, useContext, useEffect } from "react";
import { THEME_STORAGE_KEY, type Theme } from "./constants";

export type { Theme };

interface ThemeContextValue {
  theme: Theme;
}

const LIGHT: ThemeContextValue = { theme: "light" };
const ThemeContext = createContext<ThemeContextValue>(LIGHT);

/**
 * Uygulama yalnız açık temada çalışır; koyu tema kaldırıldı.
 *
 * `<html data-theme="light">` sunucuda yazılıyor. Burada yalnızca eskiden
 * kaydedilmiş tema tercihi temizleniyor.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // Gizli sekmede depolama kapalı olabilir; önemi yok.
    }
  }, []);

  return <ThemeContext.Provider value={LIGHT}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
