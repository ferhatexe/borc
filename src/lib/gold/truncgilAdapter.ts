import { CurrencyRate, GoldPriceProvider, GoldProviderResult, TRACKED_CURRENCIES } from "./types";
import { buildGoldRecords, CURRENCY_NAMES, parsePrice, RawQuote } from "./mapping";

const REQUEST_TIMEOUT_MS = 6000;

interface TruncgilQuote {
  Buying?: number | string;
  Selling?: number | string;
  Type?: string;
  Name?: string;
  Change?: number | string;
}

/**
 * Reads the Truncgil v4 payload shape, which is a flat map of
 * `{ CODE: { Buying, Selling, Type } }` entries.
 */
export function mapTruncgilRates(
  rates: Record<string, TruncgilQuote>,
  providerUpdatedAt: string | null = null
): GoldProviderResult {
  const quote = (code: string): RawQuote | null => {
    const raw = rates?.[code];
    if (!raw) return null;
    const sell = parsePrice(raw.Selling);
    const buy = parsePrice(raw.Buying ?? raw.Selling);
    if (!sell || sell <= 0) return null;
    return { buy: buy > 0 ? buy : sell, sell };
  };

  const changeOf = (code: string): number | null => {
    const raw = rates?.[code]?.Change;
    if (raw === undefined || raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Döviz kurları: yalnızca takip edilen ve gerçekten fiyatı olanlar.
  const currencies: CurrencyRate[] = [];
  for (const code of TRACKED_CURRENCIES) {
    const q = quote(code);
    if (!q) continue;
    currencies.push({
      code,
      name: CURRENCY_NAMES[code] ?? code,
      buyPrice: q.buy,
      sellPrice: q.sell,
      changePercent: changeOf(code),
    });
  }

  // "Gram has altın" is the pure-gold basis for every millesimal calculation.
  // GRA (gram altın) is the fallback when HAS is not published.
  const pure = quote("HAS") || quote("GRA");
  if (!pure) {
    throw new Error("Truncgil yanıtında has altın gram fiyatı bulunamadı.");
  }

  return buildGoldRecords({
    pure,
    pureChangePercent: changeOf("HAS") ?? changeOf("GRA"),
    currencies,
    providerUpdatedAt,
    gram: quote("GRA"),
    ceyrek: quote("CEYREKALTIN"),
    yarim: quote("YARIMALTIN"),
    tam: quote("TAMALTIN"),
    ata: quote("ATAALTIN") || quote("CUMHURIYETALTINI"),
    gremse: quote("GREMSEALTIN") || quote("IKIBUCUKALTIN"),
    bilezik22: quote("YIA"),
    bilezik18: quote("18AYARALTIN"),
    bilezik14: quote("14AYARALTIN"),
  });
}

/**
 * Primary provider: Truncgil finance API (nested `Rates` object).
 * Endpoint verified against https://finance.truncgil.com/api/today.json
 */
export class TruncgilGoldAdapter implements GoldPriceProvider {
  id = "truncgil-finance-v4";
  name = "Truncgil Finance (canlı)";

  private readonly endpoint = "https://finance.truncgil.com/api/today.json";

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

      if (!res.ok) throw new Error(`Truncgil Finance HTTP ${res.status}`);

      const data = (await res.json()) as {
        Rates?: Record<string, TruncgilQuote>;
        Meta_Data?: { Update_Date?: string };
      };
      if (!data?.Rates) throw new Error("Truncgil Finance yanıtında `Rates` alanı yok.");

      return mapTruncgilRates(data.Rates, data.Meta_Data?.Update_Date ?? null);
    } finally {
      clearTimeout(timeout);
    }
  }
}
