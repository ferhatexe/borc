"use client";

import { useEffect, useState } from "react";
import {
  AppSettings,
  DEFAULT_SETTINGS,
  SETTING_KEYS,
} from "@/lib/settings/defaults";

/**
 * Reads the user's configurable rates, margins and tables from the API.
 *
 * Forms use this instead of writing `kkdfRate: 0.15` inline, so changing a rate
 * in Ayarlar changes every calculation in the app (şartname §11).
 */
export function useAppSettings(): { settings: AppSettings; loading: boolean; error: string | null } {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Ayarlar yüklenemedi");
        const raw = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;

        setSettings({
          taxRates: { ...DEFAULT_SETTINGS.taxRates, ...(raw[SETTING_KEYS.TAX_RATES] as object) },
          goldMargins: {
            ...DEFAULT_SETTINGS.goldMargins,
            ...(raw[SETTING_KEYS.GOLD_MARGINS] as object),
          },
          goldMillesimal: {
            ...DEFAULT_SETTINGS.goldMillesimal,
            ...(raw[SETTING_KEYS.GOLD_KARAT_MILLESIMAL] as object),
          },
          goldUnitGrams: {
            ...DEFAULT_SETTINGS.goldUnitGrams,
            ...(raw[SETTING_KEYS.GOLD_UNIT_GRAMS] as object),
          },
          goldManualPrices: {
            ...DEFAULT_SETTINGS.goldManualPrices,
            ...(raw[SETTING_KEYS.GOLD_MANUAL_PRICES] as object),
          },
          appPreferences: {
            ...DEFAULT_SETTINGS.appPreferences,
            ...(raw[SETTING_KEYS.APP_PREFERENCES] as object),
          },
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ayarlar yüklenemedi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading, error };
}
