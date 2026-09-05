import { GoldPriceProvider, GoldProviderResult } from "./types";
import { mapTruncgilRates } from "./truncgilAdapter";

const REQUEST_TIMEOUT_MS = 6000;

/**
 * Secondary provider. Same vendor but a different host and a flat payload
 * (quotes sit at the document root instead of under `Rates`), so it survives an
 * outage of the primary host on its own.
 * Endpoint verified against https://finans.truncgil.com/v4/today.json
 */
export class TruncgilFlatGoldAdapter implements GoldPriceProvider {
  id = "truncgil-flat-v4";
  name = "Truncgil v4 (yedek canlı)";

  private readonly endpoint = "https://finans.truncgil.com/v4/today.json";

  async fetchPrices(signal?: AbortSignal): Promise<GoldProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    signal?.addEventListener("abort", () => controller.abort(), { once: true });

    try {
      const res = await fetch(this.endpoint, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error(`Truncgil v4 HTTP ${res.status}`);

      const data = (await res.json()) as Record<string, unknown>;
      // Flat payload: strip the metadata keys and treat the rest as quotes.
      const { Update_Date: _u, Meta_Data: _m, ...rates } = data;
      return mapTruncgilRates(rates as never);
    } finally {
      clearTimeout(timeout);
    }
  }
}
