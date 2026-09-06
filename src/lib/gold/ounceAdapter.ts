const REQUEST_TIMEOUT_MS = 6000;

export interface OunceFetchResult {
  usd: number;
  source: string;
}

/**
 * ONS altın (XAU/USD) fiyatı.
 *
 * Neden ayrı bir kaynak: birincil sağlayıcı `ONS` alanını yayınlıyor ama alış
 * ve satışı sıfır geliyor (yalnızca günlük değişim yüzdesi dolu). Bu yüzden
 * ons, gram has altından türetiliyordu:
 *
 *   ONS ≈ (gram has TL / USD-TRY) × 31,1035
 *
 * Türetilen değer piyasa fiyatını tutturmuyor - ölçtüğümüzde 4.403 USD
 * veriyordu, gerçek kotasyon 4.430 USD idi (~%0,6, ons başına 27 dolar). Aradaki
 * fark İstanbul gram fiyatının spot ons ile arasındaki prim/iskontodan ve kur
 * seçiminden geliyor; oran seçerek kapanacak bir fark değil, o yüzden ons
 * artık doğrudan çekiliyor.
 *
 * İki kaynak sırayla denenir; ikisi de düşerse çağıran taraf eski türetme
 * yöntemine döner ve değer arayüzde "hesaplanan" olarak etiketlenir.
 */
export class OunceAdapter {
  id = "xau-usd";
  name = "XAU/USD canlı kotasyon";

  /** Sade JSON: {"price": 4431.100098, ...} */
  private async fetchGoldApi(signal: AbortSignal): Promise<OunceFetchResult | null> {
    const res = await fetch("https://api.gold-api.com/price/XAU", {
      signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;

    const json: unknown = await res.json();
    const price = (json as { price?: unknown })?.price;
    const usd = Number(price);
    return Number.isFinite(usd) && usd > 0 ? { usd, source: "gold-api.com" } : null;
  }

  /**
   * Swissquote'un halka açık akışı. Birden çok spread profili döner; alış ve
   * satışın ortası alınır, böylece profil seçimi fiyatı kaydırmaz.
   */
  private async fetchSwissquote(signal: AbortSignal): Promise<OunceFetchResult | null> {
    const res = await fetch(
      "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD",
      { signal, cache: "no-store", headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;

    const json: unknown = await res.json();
    if (!Array.isArray(json) || json.length === 0) return null;

    const profiles = (json[0] as { spreadProfilePrices?: unknown })?.spreadProfilePrices;
    if (!Array.isArray(profiles) || profiles.length === 0) return null;

    const first = profiles[0] as { bid?: unknown; ask?: unknown };
    const bid = Number(first.bid);
    const ask = Number(first.ask);
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) return null;

    return { usd: (bid + ask) / 2, source: "swissquote.com" };
  }

  /** ONS/USD kotasyonu; hiçbir kaynak cevap vermezse null. */
  async fetchOunceUsd(signal?: AbortSignal): Promise<OunceFetchResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    signal?.addEventListener("abort", () => controller.abort(), { once: true });

    try {
      for (const fetchOne of [this.fetchGoldApi, this.fetchSwissquote]) {
        try {
          const quote = await fetchOne.call(this, controller.signal);
          if (quote) return quote;
        } catch {
          // Sıradaki kaynağa geç.
        }
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Çekilen onsun akla yatkın olup olmadığını, gram has altından türetilen
 * değere göre kontrol eder.
 *
 * İkisi aynı metali fiyatlıyor; aralarındaki fark prim ve kur seçiminden
 * geliyor ve pratikte %1'i geçmiyor. Bu yüzden geniş bir bant yeterli: amaç
 * ufak sapmayı yakalamak değil, kaynağın bozulup alakasız bir sayı (0, birim
 * hatası, gram fiyatı) döndürmesini yakalamak.
 */
export function isPlausibleOunceUsd(
  quoted: number,
  derived: number,
  tolerance = 0.2
): boolean {
  if (!Number.isFinite(quoted) || quoted <= 0) return false;
  if (!Number.isFinite(derived) || derived <= 0) return false;
  return Math.abs(quoted - derived) / derived <= tolerance;
}
