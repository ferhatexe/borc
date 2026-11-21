/**
 * Kurum adından bankanın logosunu bulur.
 *
 * Logo uygulamayla birlikte dağıtılmaz; hepsi çalışma anında yüklenir:
 *  1. Bankanın resmî mobil uygulamasının App Store simgesi (kare, 512 px).
 *     Adres `/api/bank-icon/<uygulama no>` üzerinden çözülür, çünkü Apple'ın
 *     görsel adresi uygulama güncellendikçe değişir.
 *  2. Yüklenemezse bankanın kendi sitesindeki logo (`wideLogo`) ya da
 *     Google'ın favicon servisi (`domain`).
 *  3. O da olmazsa kısa ad / baş harfler.
 */
export interface InstitutionBrand {
  /** Bankanın App Store'daki resmî uygulamasının simgesi (bizim yönlendirme adresimiz). */
  appIconUrl: string | null;
  /** Favicon'u net (en az ~32 px) olan bankanın alan adı. */
  domain: string | null;
  /** Rozette baş harf yerine yazılacak kısa ad. */
  short: string | null;
  /**
   * Bankanın kendi sitesindeki logo. Görsel "amblem + yazı" biçiminde
   * yataydır; rozet yalnızca kare amblemi gösterir.
   */
  wideLogo: WideLogo | null;
}

export interface WideLogo {
  url: string;
  /** Görselin genişlik / yükseklik oranı. */
  aspect: number;
  /** Amblemin başladığı yer, görsel genişliğinin oranı olarak (0 = en sol). */
  offset?: number;
}

const BRANDS: Array<{
  match: RegExp;
  /** App Store (Türkiye) uygulama numarası; resmî banka uygulaması. */
  appStoreId?: number;
  domain?: string;
  short?: string;
  wideLogo?: WideLogo;
}> = [
  // Sıra önemli: "Ziraat Katılım" "Ziraat"ten, "Vakıf Katılım" "VakıfBank"tan önce.
  { match: /ziraat\s*katılım/, appStoreId: 1181873648, domain: "ziraatkatilim.com.tr" },
  { match: /vakıf\s*katılım/, appStoreId: 1144383102, domain: "vakifkatilim.com.tr" },
  {
    match: /emlak\s*katılım/,
    appStoreId: 1467874818,
    short: "EK",
    wideLogo: { url: "https://www.emlakkatilim.com.tr/icon.svg", aspect: 1 },
  },
  { match: /ziraat/, appStoreId: 885993234, domain: "ziraatbank.com.tr" },
  { match: /garanti/, appStoreId: 521117624, domain: "garantibbva.com.tr" },
  { match: /yapı\s*kredi/, appStoreId: 458627086, domain: "yapikredi.com.tr" },
  { match: /akbank/, appStoreId: 560516360, domain: "akbank.com" },
  { match: /iş\s*bank|isbank/, appStoreId: 308261752, domain: "isbank.com.tr" },
  { match: /halk\s*bank/, appStoreId: 1068841746, domain: "halkbank.com.tr" },
  { match: /enpara/, appStoreId: 6711348553, domain: "enpara.com" },
  // Türkçe küçültmede "ING" -> "ıng" olur.
  { match: /(^|[^\p{L}])[iı]ng([^\p{L}]|$)/u, appStoreId: 395535459, domain: "ing.com.tr" },
  // Sitedeki SVG 205x46; amblem (dümen) sağ uçta, son 46 birim.
  {
    match: /deniz\s*bank/,
    appStoreId: 1403334281,
    short: "DB",
    wideLogo: { url: "https://www.denizbank.com/_assets/img/denizbank.svg", aspect: 205 / 46, offset: (205 - 46) / 205 },
  },
  { match: /albaraka/, appStoreId: 1428860724, domain: "albaraka.com.tr" },
  { match: /kuveyt/, appStoreId: 840914223, domain: "kuveytturk.com.tr" },
  { match: /papara/, appStoreId: 1146507477, domain: "papara.com" },
  { match: /getir/, appStoreId: 6758653941, domain: "getirfinans.com" },
  // Sitedeki logo 280x82; amblem soldaki 83 px'lik kare.
  {
    match: /qnb|finansbank/,
    appStoreId: 739655617,
    short: "QNB",
    wideLogo: { url: "https://www.qnb.com.tr/_assets/img/logo.png", aspect: 280 / 82 },
  },
  // Sitedeki logo 131x61; amblem soldaki yeşil kare.
  {
    match: /(^|[^\p{L}])teb([^\p{L}]|$)/u,
    appStoreId: 353385550,
    short: "TEB",
    wideLogo: { url: "https://www.teb.com.tr/images/TEB/mainLogo.jpg", aspect: 131 / 61 },
  },
  // Sitedeki SVG 250x32; amblem soldaki sarı paralelkenar.
  {
    match: /vakıf\s*bank/,
    appStoreId: 853569450,
    short: "VB",
    wideLogo: { url: "https://www.vakifbank.com.tr/Templates/Default/assets/img/logo.svg", aspect: 250 / 32 },
  },
  // Sitedeki SVG 200x40; amblem yazının sağında.
  {
    match: /şeker\s*bank/,
    appStoreId: 626133531,
    short: "ŞB",
    wideLogo: { url: "https://www.sekerbank.com.tr/icons/sekerbankLogo73tr.svg", aspect: 200 / 40, offset: 0.55 },
  },
];

/** Simge adresi yalnızca bu uygulamalar için çözülür (açık yönlendirici olmasın). */
export const KNOWN_APP_STORE_IDS: ReadonlySet<number> = new Set(
  BRANDS.map((b) => b.appStoreId).filter((id): id is number => typeof id === "number")
);

export function brandFor(name: string): InstitutionBrand | null {
  const key = name.toLocaleLowerCase("tr");
  const hit = BRANDS.find((b) => b.match.test(key));
  return hit
    ? {
        appIconUrl: hit.appStoreId ? `/api/bank-icon/${hit.appStoreId}` : null,
        domain: hit.domain ?? null,
        short: hit.short ?? null,
        wideLogo: hit.wideLogo ?? null,
      }
    : null;
}

export function brandLogoUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}
