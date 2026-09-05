"use client";

import { useCallback, useEffect, useState } from "react";
import type { GoldPriceRecord } from "@/lib/gold/types";

export interface GoldPriceState {
  prices: GoldPriceRecord[];
  pureGramSellTL: number;
  source: string | null;
  sourceKind: string | null;
  fetchedAt: string | null;
  warning: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Canlı altın fiyatlarını /api/gold üzerinden okur.
 *
 * Borç ekleme sihirbazı bunu kullanır; daha önce formun içinde koda gömülü bir
 * fiyat tablosu vardı ve önizleme, kaydedilen tutardan farklı çıkıyordu.
 * Fiyat alınamazsa `prices` boş kalır ve arayüz tutar göstermek yerine
 * durumu bildirir - uydurma bir rakam üretilmez.
 */
export function useGoldPrices(): GoldPriceState {
  const [state, setState] = useState<Omit<GoldPriceState, "refresh">>({
    prices: [],
    pureGramSellTL: 0,
    source: null,
    sourceKind: null,
    fetchedAt: null,
    warning: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/gold");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Altın fiyatları alınamadı");

      setState({
        prices: data.prices ?? [],
        pureGramSellTL: data.pureGramSellTL ?? 0,
        source: data.source ?? null,
        sourceKind: data.sourceKind ?? null,
        fetchedAt: data.fetchedAt ?? null,
        warning: data.warning ?? null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Altın fiyatları alınamadı",
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
