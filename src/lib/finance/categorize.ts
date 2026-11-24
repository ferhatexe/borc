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
  // Yazım hatası: ilk harf tutmalı ("marti" "karti" değildir); 4 harfte yalnız
  // harf değişimi ("mama" "magma" değildir).
  if (typed.length < 4 || known.length < 4 || typed[0] !== known[0]) return false;
  if (Math.min(typed.length, known.length) < 5 && typed.length !== known.length) return false;
  return withinDistance(typed, known, known.length >= 8 ? 2 : 1);
}

/**
 * Anahtar kelime -> kategori adı (en özelden genele). Adlar normalize edilmiş
 * hâlleriyle aranır; kullanıcıda o kategori yoksa sıradakine bakılır.
 * Boşluklu ifadeler metnin içinde aranır.
 */
const KEYWORDS: Array<{ targets: string[]; words: string[] }> = [
  { targets: ["market", "market gida"], words: ["market", "migros", "a101", "bim", "sok", "carrefour", "carrefoursa", "file", "macrocenter", "bakkal", "ekmek", "sut", "peynir", "yumurta", "kola", "cips", "gida", "deterjan", "sampuan", "getir", "tekel", "su", "damacana", "icecek", "cikolata", "biskuvi", "atistirmalik", "temizlik", "pecete", "tuvalet kagidi", "yag", "seker", "un", "pirinc", "makarna", "salca", "zeytin", "bal", "recel", "su aldim", "kuruyemis", "dondurma", "gazoz", "soda", "ayran", "meyve suyu", "enerji icecegi", "redbull", "red bull", "hakmar", "onur market", "metro market", "happy center"] },
  { targets: ["manav kasap", "market gida"], words: ["manav", "kasap", "meyve", "sebze", "tavuk", "et", "kiyma", "balik", "pazar", "pazardan", "sarkuteri", "firin"] },
  { targets: ["disarida yemek", "market gida"], words: ["yemek", "restoran", "lokanta", "doner", "kebap", "kebab", "pide", "lahmacun", "burger", "pizza", "tost", "yemeksepeti", "trendyol yemek", "trendyolyemek", "getir yemek", "migros yemek", "kofte", "cigkofte", "simit", "borek", "kahvalti", "durum", "tantuni", "makarna yedik", "corba", "yeme icme", "disarda yemek", "cig kofte", "mcdonalds", "burger king", "kfc", "dominos", "popeyes", "little caesars", "sandvic", "kokorec", "midye", "iskender", "manti", "pilav", "nohut pilav", "balik ekmek", "aksam yemegi", "ogle yemegi", "yedik", "tatli", "baklava", "kunefe", "pastane", "waffle"] },
  { targets: ["kahve", "market gida"], words: ["kahve", "starbucks", "kahve dunyasi", "cafe", "kafe", "espresso", "latte", "nescafe", "cay", "caycı", "caybahcesi", "cay bahcesi", "kafeterya", "gloria jeans", "caribou", "espressolab", "mado"] },
  { targets: ["sigara", "tutun", "kisisel", "market"], words: ["sigara", "tutun", "nargile", "puro", "marlboro", "parliament", "camel", "winston", "elektronik sigara", "likit", "sarma"] },
  { targets: ["yakit", "ulasim"], words: ["benzin", "mazot", "motorin", "akaryakit", "yakit", "shell", "opet", "petrol ofisi", "lpg", "aytemiz", "bp", "total", "po"] },
  { targets: ["toplu tasima", "ulasim"], words: ["otobus", "metrobus", "marmaray", "akbil", "istanbulkart", "kentkart", "dolmus", "minibus", "vapur", "tramvay", "metro", "bilet ucak", "ucak", "ucak bileti", "otobus bileti", "tren", "yht", "thy", "pegasus", "ajet", "kart dolum", "kart yukleme"] },
  { targets: ["taksi", "ulasim"], words: ["taksi", "uber", "bitaksi", "martı", "marti", "scooter", "binbin"] },
  { targets: ["otopark", "ulasim"], words: ["otopark", "ispark", "park"] },
  { targets: ["kopru otoyol", "ulasim"], words: ["hgs", "ogs", "kopru", "otoyol"] },
  { targets: ["sigorta kasko", "ulasim"], words: ["kasko", "trafik sigortasi", "sigorta"] },
  { targets: ["mtv", "ulasim"], words: ["mtv", "motorlu tasitlar"] },
  { targets: ["arac bakim", "ulasim"], words: ["tamir", "lastik", "yag degisimi", "oto yikama", "yikama", "sanayi", "akü", "aku", "servis", "muayene arac", "arac muayene", "tuvturk"] },
  { targets: ["ulasim"], words: ["yol", "yol parasi", "araba", "arac", "yolculuk", "ulasim"] },
  { targets: ["elektrik", "konut"], words: ["elektrik", "enerjisa", "ck enerji", "bedas", "ayedas"] },
  { targets: ["su", "konut"], words: ["iski", "su faturasi", "aski", "izsu", "buski", "su parasi"] },
  { targets: ["dogalgaz", "konut"], words: ["dogalgaz", "igdas", "kombi", "dogal gaz", "gaz faturasi"] },
  { targets: ["internet", "konut"], words: ["internet", "superonline", "ttnet", "turknet", "wifi", "modem", "fiber", "internet faturasi"] },
  { targets: ["kira", "konut"], words: ["kira", "ev kirasi"] },
  { targets: ["aidat", "konut"], words: ["aidat", "site aidati"] },
  { targets: ["tadilat", "konut"], words: ["tadilat", "boya", "usta", "tesisat", "koctas", "bauhaus", "tesisatci", "elektrikci", "cilingir", "hirdavat", "ikea", "mobilya", "beyaz esya"] },
  { targets: ["gsm", "telefon abonelik"], words: ["turkcell", "vodafone", "turk telekom", "kontor", "fatura telefon", "hat", "telefon", "telefon faturasi", "tl yukleme", "paket", "bimcell", "pttcell"] },
  { targets: ["streaming", "telefon abonelik"], words: ["netflix", "spotify", "youtube", "disney", "exxen", "blutv", "amazon prime", "prime video", "tabii", "gain", "tod", "bein", "dsmart", "digiturk", "apple music", "mubi"] },
  { targets: ["yazilim bulut", "telefon abonelik"], words: ["claude", "chatgpt", "openai", "icloud", "google one", "linkedin", "adobe", "microsoft", "abonelik", "uyelik", "app store", "google play", "canva", "dropbox", "cursor", "github"] },
  { targets: ["konut"], words: ["fatura", "faturalar", "ev gideri"] },
  { targets: ["ilac", "saglik"], words: ["eczane", "ilac", "vitamin", "recete", "agri kesici"] },
  { targets: ["doktor", "saglik"], words: ["doktor", "hastane", "muayene", "klinik", "tahlil", "acil", "rontgen", "psikolog", "terapi", "fizik tedavi"] },
  { targets: ["dis", "saglik"], words: ["dis", "disci", "dis hekimi"] },
  { targets: ["gozluk", "saglik"], words: ["gozluk", "lens", "optik"] },
  { targets: ["ayakkabi", "giyim"], words: ["ayakkabi", "bot", "terlik", "flo", "sneaker", "nike", "adidas", "skechers", "in street", "instreet", "ayakkabi dunyasi"] },
  { targets: ["giyim"], words: ["giyim", "kiyafet", "tisort", "pantolon", "mont", "ceket", "gomlek", "kazak", "lcw", "lc waikiki", "defacto", "koton", "zara", "mavi", "boyner", "trendyol", "shein", "hm", "h m", "bershka", "pull bear", "mango", "colins", "ltb", "corap", "esofman", "elbise", "etek", "canta"] },
  { targets: ["kuafor", "kisisel"], words: ["kuafor", "berber", "tiras", "sac", "sac kesimi", "manikur", "agda"] },
  { targets: ["kisisel"], words: ["kozmetik", "parfum", "gratis", "watsons", "rossmann", "deodorant", "krem", "makyaj", "jilet", "kisisel bakim"] },
  { targets: ["spor", "kisisel"], words: ["spor", "gym", "fitness", "spor salonu", "macfit", "protein", "pilates", "yoga", "havuz"] },
  { targets: ["eglence", "hobi", "kisisel"], words: ["sinema", "oyun", "playstation", "ps plus", "steam", "xbox", "nintendo", "switch", "pubg", "valorant", "konser", "hali saha", "halisaha", "bowling", "tiyatro", "eglence", "tiktok", "instagram", "biletix", "passo", "mac bileti", "bilet", "lunapark", "bilardo", "playstation cafe", "ps cafe", "internet kafe", "bar", "pub", "alkol", "bira", "raki", "sarap", "otel", "tatil", "gezi", "airbnb", "booking"] },
  { targets: ["hobi", "kisisel"], words: ["hobi", "olta", "kamp", "muzik aleti", "gitar"] },
  { targets: ["cocuk", "aile sosyal"], words: ["harclik", "cocuk", "bebek", "oyuncak", "bez", "bebek bezi", "mama", "biberon", "kres"] },
  { targets: ["hediye", "aile sosyal"], words: ["hediye", "cicek", "dogum gunu", "pasta"] },
  { targets: ["bagis", "aile sosyal"], words: ["bagis", "sadaka", "zekat", "fitre", "kurban"] },
  { targets: ["dugun nisan", "aile sosyal"], words: ["dugun", "nisan", "kina", "takı", "taki"] },
  { targets: ["kitap", "egitim"], words: ["kitap", "kirtasiye", "defter", "kalem", "fotokopi"] },
  { targets: ["kurs", "egitim"], words: ["kurs", "ders", "udemy", "dershane", "etut", "ozel ders"] },
  { targets: ["okul harc", "egitim"], words: ["okul", "harc", "universite", "servis ucreti", "okul servisi"] },
  { targets: ["kargo", "isletme giderleri"], words: ["kargo", "ptt", "yurtici", "aras", "mng", "surat kargo", "hepsijet", "trendyol express"] },
  { targets: ["vergi sgk", "isletme giderleri"], words: ["vergi", "sgk", "bagkur", "gelir vergisi", "kdv", "stopaj"] },
  { targets: ["muhasebe", "isletme giderleri"], words: ["muhasebe", "mali musavir", "muhasebeci"] },
  { targets: ["reklam", "isletme giderleri"], words: ["reklam", "meta ads", "google ads", "sponsorlu"] },
  { targets: ["beklenmedik", "diger giderler"], words: ["ceza", "trafik cezasi", "noter", "avukat", "icra", "mahkeme", "harc mahkeme", "tamirat acil", "kayip"] },
  { targets: ["alisveris", "online alisveris", "elektronik", "diger giderler"], words: ["hepsiburada", "amazon", "temu", "n11", "aliexpress", "ciceksepeti", "teknosa", "mediamarkt", "media markt", "vatan", "vatan bilgisayar", "apple", "samsung", "xiaomi", "kulaklik", "sarj", "kablo", "elektronik", "alisveris"] },
  { targets: ["kredi karti", "borc odemesi"], words: ["kart borcu", "kredi karti borcu", "kart odemesi", "ekstre"] },
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

/**
 * "exact": ifade sözcük sınırıyla geçiyor ya da sözcük birebir aynı.
 * "loose": ek almış ya da yazım hatalı hâli de sayılır. Önce tüm kurallar
 * exact denenir ki "tren" "trendyol"u, "taksi" "taksit"i kapmasın.
 */
function textHas(normalized: string, tokens: string[], word: string, mode: "exact" | "loose"): boolean {
  if (word.includes(" ")) {
    if (` ${normalized} `.includes(` ${word} `)) return true;
    // Bitişik yazılmış ifade: "halisaha", "trendyolyemek".
    return mode === "loose" && tokens.some((t) => wordsMatch(t, word.replace(/ /g, "")));
  }
  return tokens.some((t) => (mode === "exact" ? t === word : wordsMatch(t, word)));
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
  const byCategoryName = (mode: "exact" | "loose"): CategorySuggestion | null => {
    for (const c of [...children, ...parents]) {
      const name = normalizeText(c.name);
      if (name.length >= 3 && textHas(normalized, tokens, name, mode)) {
        return { categoryId: byName.get(name)!.id, source: "kelime" };
      }
    }
    return null;
  };

  // 4. Sözlük: önce çok sözcüklü ifadeler ("su faturası" Su'ya, "su" Market'e).
  const byDictionary = (mode: "phrase" | "exact" | "loose"): CategorySuggestion | null => {
    for (const entry of KEYWORDS) {
      const hit = entry.words.some((w) => {
        const word = normalizeText(w);
        if (mode === "phrase") return word.includes(" ") && textHas(normalized, tokens, word, "exact");
        return textHas(normalized, tokens, word, mode);
      });
      if (!hit) continue;
      for (const target of entry.targets) {
        const cat = byName.get(target);
        if (cat) return { categoryId: cat.id, source: "kelime" };
      }
    }
    return null;
  };

  return (
    byDictionary("phrase") ??
    byCategoryName("exact") ??
    byDictionary("exact") ??
    byCategoryName("loose") ??
    byDictionary("loose")
  );
}
