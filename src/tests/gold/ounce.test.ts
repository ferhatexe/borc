import { describe, it, expect, vi, afterEach } from "vitest";
import { OunceAdapter, isPlausibleOunceUsd } from "@/lib/gold/ounceAdapter";

/** gold-api.com'un gerçek cevabı. */
const GOLD_API = {
  currency: "USD",
  currencySymbol: "$",
  exchangeRate: 1.0,
  name: "Gold",
  price: 4431.100098,
  symbol: "XAU",
  updatedAt: "2026-09-06T10:43:04Z",
};

/** Swissquote'un gerçek cevabından kısaltılmış örnek. */
const SWISSQUOTE = [
  {
    topo: { platform: "SwissquoteLtd", server: "Live5" },
    spreadProfilePrices: [
      { spreadProfile: "premium", bid: 4430.579, ask: 4431.241 },
      { spreadProfile: "prime", bid: 4430.593, ask: 4431.227 },
    ],
  },
];

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => handler(String(input))));
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("ONS kotasyonu", () => {
  it("birincil kaynaktan XAU/USD okur", async () => {
    mockFetch(() => json(GOLD_API));

    const quote = await new OunceAdapter().fetchOunceUsd();
    expect(quote?.usd).toBeCloseTo(4431.1, 2);
    expect(quote?.source).toBe("gold-api.com");
  });

  it("birincil kaynak düşerse Swissquote'a geçer ve alış/satış ortasını alır", async () => {
    mockFetch((url) =>
      url.includes("gold-api.com") ? json({ error: "down" }, 503) : json(SWISSQUOTE)
    );

    const quote = await new OunceAdapter().fetchOunceUsd();
    // (4430,579 + 4431,241) / 2
    expect(quote?.usd).toBeCloseTo(4430.91, 2);
    expect(quote?.source).toBe("swissquote.com");
  });

  it("birincil kaynak hata fırlatsa bile ikinciye geçer", async () => {
    mockFetch((url) => {
      if (url.includes("gold-api.com")) throw new Error("ağ hatası");
      return json(SWISSQUOTE);
    });

    expect((await new OunceAdapter().fetchOunceUsd())?.source).toBe("swissquote.com");
  });

  it("iki kaynak da düşerse null döner; çağıran taraf türetmeye dönebilsin", async () => {
    mockFetch(() => json({}, 500));
    expect(await new OunceAdapter().fetchOunceUsd()).toBeNull();
  });

  it("sağlayıcı fiyatı sıfır ya da eksik gönderirse kabul etmez", async () => {
    mockFetch((url) =>
      url.includes("gold-api.com") ? json({ ...GOLD_API, price: 0 }) : json([])
    );
    expect(await new OunceAdapter().fetchOunceUsd()).toBeNull();
  });
});

describe("ONS akla yatkınlık kontrolü", () => {
  // Gerçek ölçüm: sağlayıcının gram fiyatından türetilen 4.403 USD'ye karşı
  // piyasa kotasyonu 4.431 USD. Aradaki fark kabul edilmeli.
  it("türetilenle kotasyon arasındaki normal farkı kabul eder", () => {
    expect(isPlausibleOunceUsd(4431.1, 4403.09)).toBe(true);
  });

  it("sıfır ve negatif değerleri reddeder", () => {
    expect(isPlausibleOunceUsd(0, 4403.09)).toBe(false);
    expect(isPlausibleOunceUsd(-4431, 4403.09)).toBe(false);
    expect(isPlausibleOunceUsd(4431.1, 0)).toBe(false);
  });

  it("birim hatasını yakalar", () => {
    // Kaynak gram fiyatı ya da kuruş cinsi bir sayı döndürürse.
    expect(isPlausibleOunceUsd(142.5, 4403.09)).toBe(false);
    expect(isPlausibleOunceUsd(443110, 4403.09)).toBe(false);
  });
});
