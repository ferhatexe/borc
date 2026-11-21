/**
 * Harcama tanımından kategori tahmini ("Migros" -> Market, "yemej" -> Dışarıda Yemek).
 *
 * Sıra:
 *  1. Kullanıcının geçmişi: aynı tanımı daha önce nereye koyduysa oraya.
 *  2. Geçmişte benzer kelime geçen harcamaların kategorisi.
 *  3. Kategorinin kendi adı tanımda geçiyorsa ("kahve" -> Kahve).
 *  4. Türkçe anahtar kelime sözlüğü (marka ve günlük sözcükler).
 *
 * Yazım hatası tolere edilir: 4+ harfli sözcüklerde bir harf farkı eşleşir.
 * Hiçbiri tutmazsa null döner; form o zaman elle seçilen kategoride kalır.
 */

export interface CategoryLite {
  id: string;
  name: string;
  parentId: string | null;
}

export interface CategoryHint {
  merchant: string;
  categoryId: string;
}

export interface CategorySuggestion {
  categoryId: string;
  source: "gecmis" | "kelime";
}

const DEACCENT: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Küçük harf, Türkçe harfler sadeleşir, harf/rakam dışı her şey boşluk olur. */
export function normalizeText(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (ch) => DEACCENT[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Kategori söylemeyen dolgu sözcükleri. */
const STOP = new Set(["ve", "ile", "icin", "diger", "odeme", "odemesi", "harcama", "harcamasi", "alim", "alimi", "aldim", "bir", "bu", "da", "de"]);

const tokensOf = (normalized: string) =>
  normalized.split(" ").filter((t) => t.length >= 2 && !STOP.has(t));

/** En fazla `max` düzenleme uzaklığında mı (erken çıkışlı Levenshtein). */
function withinDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** İki sözcük aynı şeyi mi kastediyor: birebir, Türkçe ek almış ya da bir harf hatalı. */
export function wordsMatch(typed: string, known: string): boolean {
  if (typed === known) return true;
  // Önek kuralı yalnız 4+ harfte: "dis" (diş) "disarida"yı yakalamasın.
  if (known.length >= 4 && typed.length > known.length && typed.startsWith(known) && typed.length - known.length <= 4) {
    return true; // "marketten", "yemekler", "kahveci"
  }
  if (typed.length >= 4 && known.length >= 4) return withinDistance(typed, known, known.length >= 8 ? 2 : 1);
  return false;
}

/**
 * Anahtar kelime -> kategori adı (en özelden genele). Adlar normalize edilmiş
 * hâlleriyle aranır; kullanıcıda o kategori yoksa sıradakine bakılır.
 * Boşluklu ifadeler metnin içinde aranır.
 */
const KEYWORDS: Array<{ targets: string[]; words: string[] }> = [
  { targets: ["market", "market gida"], words: ["market", "migros", "a101", "bim", "sok", "carrefour", "carrefoursa", "file", "macrocenter", "bakkal", "ekmek", "sut", "peynir", "yumurta", "kola", "cips", "gida", "deterjan", "sampuan", "getir", "tekel"] },
  { targets: ["manav kasap", "market gida"], words: ["manav", "kasap", "meyve", "sebze", "tavuk", "et", "balik", "pazar"] },
  { targets: ["disarida yemek", "market gida"], words: ["yemek", "restoran", "lokanta", "doner", "kebap", "kebab", "pide", "lahmacun", "burger", "pizza", "tost", "yemeksepeti", "kofte", "simit", "borek", "kahvalti", "durum", "tantuni", "makarna", "corba", "yeme icme", "disarda yemek", "cig kofte", "mcdonalds", "burger king", "kfc", "dominos"] },
  { targets: ["kahve", "market gida"], words: ["kahve", "starbucks", "kahve dunyasi", "cafe", "kafe", "espresso", "latte", "nescafe"] },
  { targets: ["yakit", "ulasim"], words: ["benzin", "mazot", "motorin", "akaryakit", "yakit", "shell", "opet", "petrol ofisi", "lpg", "aytemiz"] },
  { targets: ["toplu tasima", "ulasim"], words: ["otobus", "metrobus", "marmaray", "akbil", "istanbulkart", "kentkart", "dolmus", "minibus", "vapur", "tramvay", "metro", "bilet ucak", "ucak"] },
  { targets: ["taksi", "ulasim"], words: ["taksi", "uber", "bitaksi", "martı", "marti", "scooter"] },
  { targets: ["otopark", "ulasim"], words: ["otopark", "ispark"] },
  { targets: ["kopru otoyol", "ulasim"], words: ["hgs", "ogs", "kopru", "otoyol"] },
  { targets: ["arac bakim", "ulasim"], words: ["tamir", "lastik", "yag degisimi", "oto yikama", "sanayi", "akü", "aku"] },
  { targets: ["elektrik", "konut"], words: ["elektrik", "enerjisa", "ck enerji", "bedas", "ayedas"] },
  { targets: ["su", "konut"], words: ["iski", "su faturasi", "aski"] },
  { targets: ["dogalgaz", "konut"], words: ["dogalgaz", "igdas", "kombi"] },
  { targets: ["internet", "konut"], words: ["internet", "superonline", "ttnet", "turknet", "wifi", "modem", "fiber"] },
  { targets: ["kira", "konut"], words: ["kira"] },
  { targets: ["aidat", "konut"], words: ["aidat", "site aidati"] },
  { targets: ["tadilat", "konut"], words: ["tadilat", "boya", "usta", "tesisat", "koctas", "bauhaus"] },
  { targets: ["gsm", "telefon abonelik"], words: ["turkcell", "vodafone", "turk telekom", "kontor", "fatura telefon", "hat", "telefon faturasi"] },
  { targets: ["streaming", "telefon abonelik"], words: ["netflix", "spotify", "youtube", "disney", "exxen", "blutv", "amazon prime", "prime video", "tabii", "gain"] },
  { targets: ["yazilim bulut", "telefon abonelik"], words: ["claude", "chatgpt", "openai", "icloud", "google one", "linkedin", "adobe", "microsoft", "abonelik", "uyelik"] },
  { targets: ["ilac", "saglik"], words: ["eczane", "ilac", "vitamin", "recete"] },
  { targets: ["doktor", "saglik"], words: ["doktor", "hastane", "muayene", "klinik", "tahlil"] },
  { targets: ["dis", "saglik"], words: ["dis", "disci", "dis hekimi"] },
  { targets: ["gozluk", "saglik"], words: ["gozluk", "lens", "optik"] },
  { targets: ["ayakkabi", "giyim"], words: ["ayakkabi", "bot", "terlik", "flo", "sneaker"] },
  { targets: ["giyim"], words: ["giyim", "kiyafet", "tisort", "pantolon", "mont", "ceket", "gomlek", "kazak", "lcw", "lc waikiki", "defacto", "koton", "zara", "mavi", "boyner"] },
  { targets: ["kuafor", "kisisel"], words: ["kuafor", "berber", "tiras", "sac"] },
  { targets: ["spor", "kisisel"], words: ["spor", "gym", "fitness", "spor salonu"] },
  { targets: ["eglence", "hobi", "kisisel"], words: ["sinema", "oyun", "playstation", "steam", "konser", "hali saha", "halisaha", "bowling", "tiyatro", "eglence", "tiktok", "instagram"] },
  { targets: ["hediye", "aile sosyal"], words: ["hediye", "cicek"] },
  { targets: ["bagis", "aile sosyal"], words: ["bagis", "sadaka", "zekat"] },
  { targets: ["cocuk", "aile sosyal"], words: ["cocuk", "bebek", "oyuncak", "bez", "mama"] },
  { targets: ["dugun nisan", "aile sosyal"], words: ["dugun", "nisan", "kina", "takı", "taki"] },
  { targets: ["kitap", "egitim"], words: ["kitap", "kirtasiye", "defter"] },
  { targets: ["kurs", "egitim"], words: ["kurs", "ders", "udemy"] },
  { targets: ["okul harc", "egitim"], words: ["okul", "harc", "universite"] },
  { targets: ["kargo", "isletme giderleri"], words: ["kargo", "ptt", "yurtici", "aras", "mng"] },
  { targets: ["kredi taksiti", "borc odemesi"], words: ["taksit", "kredi taksiti", "kredi odemesi"] },
];

/** Kategori adlarını normalize edip "en özel önce" eşleme tablosu kurar. */
function indexCategories(categories: CategoryLite[]) {
  const byName = new Map<string, CategoryLite>();
  // Alt kategori, aynı adlı üst kategoriyi ezer (Giyim > Giyim gibi).
  const ordered = [...categories].sort((a, b) => Number(a.parentId !== null) - Number(b.parentId !== null));
  for (const c of ordered) byName.set(normalizeText(c.name), c);
  return byName;
}

function textHas(normalized: string, tokens: string[], word: string): boolean {
  if (word.includes(" ")) return normalized.includes(word);
  return tokens.some((t) => wordsMatch(t, word));
}

export function suggestCategory(
  text: string,
  categories: CategoryLite[],
  history: CategoryHint[] = []
): CategorySuggestion | null {
  const normalized = normalizeText(text);
  const tokens = tokensOf(normalized);
  if (tokens.length === 0 || categories.length === 0) return null;
  const valid = new Set(categories.map((c) => c.id));
  const usable = history.filter((h) => valid.has(h.categoryId));

  const best = (counts: Map<string, number>) => {
    let id: string | null = null;
    let top = 0;
    for (const [k, v] of counts) if (v > top) [id, top] = [k, v];
    return id;
  };

  // 1. Birebir aynı tanım.
  const exact = new Map<string, number>();
  for (const h of usable) {
    if (normalizeText(h.merchant) === normalized) exact.set(h.categoryId, (exact.get(h.categoryId) ?? 0) + 1);
  }
  const exactHit = best(exact);
  if (exactHit) return { categoryId: exactHit, source: "gecmis" };

  // 2. Geçmişte ortak sözcük (3+ harf).
  const similar = new Map<string, number>();
  for (const h of usable) {
    const hTokens = tokensOf(normalizeText(h.merchant)).filter((t) => t.length >= 3);
    if (hTokens.some((ht) => tokens.some((t) => t.length >= 3 && (wordsMatch(t, ht) || wordsMatch(ht, t))))) {
      similar.set(h.categoryId, (similar.get(h.categoryId) ?? 0) + 1);
    }
  }
  const similarHit = best(similar);
  if (similarHit) return { categoryId: similarHit, source: "gecmis" };

  const byName = indexCategories(categories);

  // 3. Kategorinin kendi adı (alt kategoriler önce). Borç ödemesi kategorileri
  // ödeme akışından gelir; "kredi kartıyla market" Borç Ödemesi'ne düşmesin.
  const parentName = new Map(categories.map((c) => [c.id, normalizeText(c.name)]));
  const isDebt = (c: CategoryLite) =>
    normalizeText(c.name) === "borc odemesi" || (c.parentId !== null && parentName.get(c.parentId) === "borc odemesi");
  const children = categories.filter((c) => c.parentId !== null && !isDebt(c));
  const parents = categories.filter((c) => c.parentId === null && !isDebt(c));
  for (const c of [...children, ...parents]) {
    const name = normalizeText(c.name);
    if (name.length >= 3 && textHas(normalized, tokens, name)) return { categoryId: byName.get(name)!.id, source: "kelime" };
  }

  // 4. Sözlük.
  for (const entry of KEYWORDS) {
    if (!entry.words.some((w) => textHas(normalized, tokens, normalizeText(w)))) continue;
    for (const target of entry.targets) {
      const hit = byName.get(target);
      if (hit) return { categoryId: hit.id, source: "kelime" };
    }
  }

  return null;
}
