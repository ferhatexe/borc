/**
 * Kurum adından bankanın kendi sitesini ve kısa adını bulur.
 *
 * Logo uygulamayla birlikte dağıtılmaz: tarayıcı bankanın kendi favicon'unu
 * çalışma anında Google'ın favicon servisinden çeker. Servisin yalnızca 16 px
 * sürümünü bildiği bankalarda (bulanık görünür) logo yerine kısa ad kullanılır.
 */
export interface InstitutionBrand {
  /** Favicon'u net (en az ~32 px) olan bankanın alan adı. */
  domain: string | null;
  /** Rozette baş harf yerine yazılacak kısa ad. */
  short: string | null;
  /**
   * Favicon'u bulanık olan banka için kendi sitesindeki logo görseli. Görsel
   * "amblem + yazı" biçiminde yataydır; rozet yalnızca soldaki kare amblemi
   * gösterir. `aspect` görselin genişlik/yükseklik oranıdır.
   */
  wideLogo: { url: string; aspect: number } | null;
}

const BRANDS: Array<{
  match: RegExp;
  domain?: string;
  short?: string;
  wideLogo?: { url: string; aspect: number };
}> = [
  // Sıra önemli: "Ziraat Katılım" "Ziraat"ten, "Vakıf Katılım" "VakıfBank"tan önce.
  { match: /ziraat\s*katılım/, domain: "ziraatkatilim.com.tr" },
  { match: /vakıf\s*katılım/, domain: "vakifkatilim.com.tr" },
  { match: /emlak\s*katılım/, short: "EK" },
  { match: /ziraat/, domain: "ziraatbank.com.tr" },
  { match: /garanti/, domain: "garantibbva.com.tr" },
  { match: /yapı\s*kredi/, domain: "yapikredi.com.tr" },
  { match: /akbank/, domain: "akbank.com" },
  { match: /iş\s*bank|isbank/, domain: "isbank.com.tr" },
  { match: /halk\s*bank/, domain: "halkbank.com.tr" },
  { match: /enpara/, domain: "enpara.com" },
  // Türkçe küçültmede "ING" -> "ıng" olur.
  { match: /(^|[^\p{L}])[iı]ng([^\p{L}]|$)/u, domain: "ing.com.tr" },
  { match: /deniz\s*bank/, domain: "denizbank.com" },
  { match: /albaraka/, domain: "albaraka.com.tr" },
  { match: /kuveyt/, domain: "kuveytturk.com.tr" },
  { match: /papara/, domain: "papara.com" },
  { match: /getir/, domain: "getirfinans.com" },
  // Sitedeki logo 280x82; amblem soldaki 83 px'lik kare.
  {
    match: /qnb|finansbank/,
    short: "QNB",
    wideLogo: { url: "https://www.qnb.com.tr/_assets/img/logo.png", aspect: 280 / 82 },
  },
  { match: /(^|[^\p{L}])teb([^\p{L}]|$)/u, short: "TEB" },
  { match: /vakıf\s*bank/, short: "VB" },
  { match: /şeker\s*bank/, short: "ŞB" },
];

export function brandFor(name: string): InstitutionBrand | null {
  const key = name.toLocaleLowerCase("tr");
  const hit = BRANDS.find((b) => b.match.test(key));
  return hit
    ? { domain: hit.domain ?? null, short: hit.short ?? null, wideLogo: hit.wideLogo ?? null }
    : null;
}

export function brandLogoUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}
