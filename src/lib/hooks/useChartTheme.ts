"use client";

import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * Grafiklerin tema duyarlı renkleri.
 *
 * Recharts renkleri satır içi stil ve prop olarak alıyor, CSS sınıfı kabul
 * etmiyor; bu yüzden tema değişkenlerinden yararlanamıyor. Sabit koyu değerler
 * (#18181b arka plan, #3f3f46 kenarlık) açık temada beyaz kartın üstünde siyah
 * bir kutu olarak duruyordu - ekranda okunmuyordu. Renkler tek yerden burada
 * veriliyor ki beş grafik de aynı davransın.
 */
export function useChartTheme() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return {
    isLight,
    /** Tooltip kutusu. */
    tooltipStyle: {
      backgroundColor: isLight ? "#ffffff" : "#18181b",
      borderColor: isLight ? "rgba(9,9,11,0.12)" : "#3f3f46",
      color: isLight ? "#18181b" : "#f4f4f5",
      borderRadius: "0.75rem",
      fontSize: "12px",
      boxShadow: isLight
        ? "0 10px 25px rgba(9,9,11,0.12)"
        : "0 10px 25px rgba(0,0,0,0.5)",
    } as const,
    /** Tooltip içindeki etiket satırı. */
    tooltipLabelStyle: { color: isLight ? "#52525b" : "#a1a1aa" } as const,
    /** Izgara ve eksenler: iki temada da okunan nötrler. */
    grid: "rgba(113,113,122,0.28)",
    axis: "#71717a",
    /** Halka dilimlerini ayıran çizgi - kartın zemini olmalı. */
    sliceStroke: isLight ? "#ffffff" : "#18181b",
  };
}
