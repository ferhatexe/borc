"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { THEME_STORAGE_KEY, DEFAULT_THEME, type Theme } from "./constants";

export type { Theme };

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** `<html data-theme>` üzerinde okunur; sunucu ve istemci aynı değeri görür. */
function readAppliedTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/**
 * Koyu / açık tema.
 *
 * Seçim `localStorage`'da durur ve ilk boyamadan ÖNCE `ThemeScript` tarafından
 * `<html data-theme>` üzerine yazılır; yoksa tema her yüklemede bir kare yanlış
 * görünürdü.
 *
 * Seçim yoksa uygulamanın ana teması olan açık tema kullanılır; işletim
 * sisteminin tercihi bilerek okunmuyor (bkz. `DEFAULT_THEME`).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

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
      theme: DEFAULT_THEME,
      setTheme: () => {},
      toggleTheme: () => {},
    }
  );
}
