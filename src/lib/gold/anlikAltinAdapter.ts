const REQUEST_TIMEOUT_MS = 6000;

/**
 * 21 ayar gram fiyatını anlikaltinfiyati.com'dan okur.
 *
 * Neden ayrı bir kaynak: birincil sağlayıcı 21 ayar kotasyonu yayınlamıyor, o
 * yüzden fiyat milyem tablosundan (has × 875/1000) türetiliyordu. Kuyumcunun
 * uyguladığı gerçek fiyat bundan farklı oluyor — ölçtüğümüzde gram başına
 * ~45 TL, 100 gramlık bir borçta ~4.500 TL fark ediyordu.
 *
 * DİKKAT: Bu bir HTML kazıma işlemidir, sağlayıcının JSON API'si yok. Sayfa
 * yapısı değişirse fiyat okunamaz. Bu yüzden dönen değer çağıran tarafta
 * türetilmiş fiyata karşı akla yatkınlık kontrolünden geçirilir; makul
 * aralığın dışındaysa reddedilip türetilmiş değere dönülür. Yani kırık bir
 * kazıma, yanlış bir borç tutarı değil, eski davranış üretir.
 */
export class AnlikAltin21Adapter {
  id = "anlikaltinfiyati-21ayar";
  name = "anlikaltinfiyati.com (21 ayar)";

  private readonly endpoint =
    "https://www.anlikaltinfiyati.com/21-ayar-altin-bugun-ne-kadar.html";

  /**
   * Sayfadaki tablo şu biçimde:
   *   title="1 gram 21 Ayar Altın = 6.023,53 TL"
   * Türkçe karakterler ve olası biçim farkları için desen esnek tutuldu.
   */
  private extractGramPrice(html: string): number | null {
    /*
     * Baştaki negatif lookbehind şart: tabloda "0.01 gram" ve "0.1 gram"
     * satırları da var ve çıpasız bir desen, "0.01 gram" içindeki son "1"i
     * "1 gram" sanıp 60,24 TL yakalıyor. Rakam, nokta veya virgülle
     * önlenmemiş bir "1" arıyoruz.
     */
    const patterns = [
      /(?<![\d.,])1\s*gram\s*21\s*Ayar\s*Alt[ıi]n\s*=\s*([\d.]+,\d{2})\s*TL/i,
      /title="1\s*gram\s*21\s*Ayar\s*Alt[ıi]n\s*=\s*([\d.]+,\d{2})\s*TL"/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (!match) continue;

      // Türkçe biçim: nokta binlik, virgül ondalık.
      const value = Number.parseFloat(match[1].replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(value) && value > 0) return value;
    }

    return null;
  }

  /** 21 ayar gram satış fiyatı (TL), okunamazsa null. */
  async fetchGramPrice(signal?: AbortSignal): Promise<number | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    signal?.addEventListener("abort", () => controller.abort(), { once: true });

    try {
      const res = await fetch(this.endpoint, {
        signal: controller.signal,
        cache: "no-store",
        headers: {
          // Bazı paylaşımlı barındırmalar user-agent'sız isteği reddediyor.
          "User-Agent":
            "Mozilla/5.0 (compatible; BorcolcmeBot/1.0; +kisisel borc takibi)",
          Accept: "text/html",
        },
      });

      if (!res.ok) return null;
      return this.extractGramPrice(await res.text());
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Kazınan fiyatın makul olup olmadığını, milyemden türetilmiş fiyata göre
 * kontrol eder. Sayfa yapısı bozulup alakasız bir sayı yakalandığında borcun
 * yanlış hesaplanmasını engeller.
 */
export function isPlausibleGramPrice(
  scraped: number,
  derived: number,
  tolerance = 0.15
): boolean {
  if (!Number.isFinite(scraped) || scraped <= 0) return false;
  if (!Number.isFinite(derived) || derived <= 0) return false;
  return Math.abs(scraped - derived) / derived <= tolerance;
}
