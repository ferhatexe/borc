# Borç & Gelir/Gider Takip

Kişisel borç (taksitli kredi, kredi kartı, KMH/ek hesap, altın, kişi borcu, senet/çek,
düzenli ödeme) ve gelir/gider takip uygulaması. Next.js 16 + PostgreSQL + Prisma.

Tüm veriler PostgreSQL'de tutulur. Uygulamada hiçbir yerde `localStorage` ya da
bellek içi geçici depo kullanılmaz; sayfa yenilendiğinde her şey veritabanından okunur.

---

## Hızlı başlangıç (yerel)

```bash
npm ci
cp .env.example .env
```

`.env` içindeki **dört zorunlu** değeri doldurun:

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | PostgreSQL bağlantı dizesi |
| `JWT_SECRET` | Oturum imzalama anahtarı, **en az 32 karakter** |
| `SEED_USER_EMAIL` | Tek kullanıcının e-postası |
| `SEED_USER_PASSWORD` | Şifresi, **en az 10 karakter** |

`JWT_SECRET` üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Sonra şemayı kurun ve başlangıç verisini yükleyin:

```bash
npx prisma migrate deploy && npx prisma db seed && npm run dev
```

`http://localhost:3000` → `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` ile giriş yapın.

> Kayıt ekranı yoktur; tek kullanıcı seed ile açılır. `SEED_USER_PASSWORD`
> her `db seed` çalıştırmasında veritabanındaki şifreyle senkronlanır, yani
> şifreyi değiştirmek için değişkeni güncelleyip seed'i tekrar çalıştırmanız yeterli.

### Komutlar

```bash
npm run dev              # geliştirme sunucusu
npm run build            # üretim derlemesi
npm test                 # birim testleri (Vitest)
npm run prisma:migrate   # yeni migration üret (geliştirme)
npm run sync:gold        # altın fiyatlarını elle senkronla
```

---

## Altın fiyat servisi

Fiyatlar `lib/gold/` altındaki **adapter** yapısıyla çekilir. Tek kaynağa bağımlılık yoktur;
sıra şöyledir:

1. **Manuel fiyatlar** — Ayarlar'da "Manuel fiyatları kullan" açıksa her şeyin önüne geçer.
2. **Truncgil Finance** (birincil) — `https://finance.truncgil.com/api/today.json`
   Yanıt `Rates` nesnesi altında `{ KOD: { Buying, Selling } }` biçimindedir.
3. **Truncgil v4** (ikincil) — `https://finans.truncgil.com/v4/today.json`
   Aynı sağlayıcının farklı hostu ve düz (flat) şeması; birincil host çökerse devreye girer.
4. **Son veritabanı snapshot'ı** — `GoldPriceSnapshot` tablosundaki en güncel kayıtlar.
5. **Manuel fiyatlar** — kapalı olsa bile son çare olarak denenir.

Hiçbiri yoksa uygulama **hata döndürür**; uydurma bir fiyat göstermez.
Veri canlı değilse arayüzde sarı uyarı bandı çıkar ("Fiyatlar X dakika önce güncellendi",
"Canlı servise ulaşılamadı, kayıtlı veri kullanılıyor" gibi).

Kullanılan ürün kodları: `HAS` (gram has altın — tüm gram hesaplarının temeli), `GRA`,
`CEYREKALTIN`, `YARIMALTIN`, `TAMALTIN`, `ATAALTIN`, `GREMSEALTIN`, `YIA` (22 ayar bilezik),
`18AYARALTIN`, `14AYARALTIN`. Sağlayıcının yayınlamadığı ürünler (örn. 21 ayar) sabit bir
değerle değil, **milyem tablosundan türetilerek** hesaplanır.

Önbellek: 15 dakika. Manuel yenileme için arayüzdeki "Fiyatları Yenile" düğmesi
veya `POST /api/gold`.

### Marj kuralları

Marjlar `Setting` tablosundaki `gold_margins` anahtarından okunur, Ayarlar'dan düzenlenir:

- **21 ayar (Halep zinciri dahil):** gram başına **+200 ₺**
- **22 ayar bilezik:** marj yok (0 ₺)
- Diğer her ürün için ayrı ayrı marj girilebilir.

Hesaplama:

```
Adet bazlı  : TL = Adet × (Birim Satış + Marj)
Gram bazlı  : TL = (Gram × Milyem × Has Altın Gram Satış) / 1000 + (Gram × Marj)
```

---

## Ayarlanabilir oranlar

Hiçbir faiz/vergi oranı koda gömülü değildir. Hepsi `Setting` tablosundan okunur ve
**Ayarlar** ekranından düzenlenir:

| Anahtar | İçerik |
|---|---|
| `tax_rates` | KKDF, BSMV, erken kapama komisyonu, kart asgari ödeme oranı |
| `gold_margins` | Ürün bazında TL marj |
| `gold_karat_millesimal` | 14/18/21/22/24 ayar milyem tablosu |
| `gold_unit_grams` | Çeyrek/yarım/tam/ata/gremse gram ağırlıkları |
| `gold_manual_prices` | Manuel altın fiyatları ve açma/kapama anahtarı |
| `app_preferences` | Para birimi, tema, yerel ayar |

Varsayılanların tek kaynağı: `src/lib/settings/defaults.ts` (seed de buradan okur).

### Faiz oranı birimi

Motorda oran birimi **açıkça sabitlenmiştir**, büyüklüğe bakarak tahmin edilmez:

- `*RatePercent` → yüzde (`3.89` = aylık %3,89)
- `kkdfRate` / `bsmvRate` / komisyon oranları → kesir (`0.15` = %15)

---

## Güvenlik notları

- Oturum jetonu **HS256 / Web Crypto** ile imzalanır (`src/lib/auth/jwt.ts`), böylece
  Edge middleware de imzayı gerçekten doğrulayabilir. Çerezin varlığı tek başına yeterli değildir.
- `JWT_SECRET` tanımlı değilse ya da 32 karakterden kısaysa giriş yapılamaz.
  Koda gömülü varsayılan anahtar **yoktur**.
- Şifreler bcrypt (12 tur) ile saklanır. Seed dışında hiçbir yerde düz metin karşılaştırma yapılmaz.
- Tüm okuma/yazma işlemleri `userId` ile sınırlandırılmıştır; bir kaydın id'sini bilmek
  ona erişmek için yeterli değildir.
- `/api/cron/gold` dışındaki tüm API uçları oturum ister. Cron ucu `CRON_SECRET`
  başlığı ya da geçerli bir oturum bekler.
- Silme işlemleri varsayılan olarak **soft delete**'tir. Kalıcı silme ayrı bir onay
  parametresi ister (`confirm=KALICI_SIL`).

---

## Yedekleme

- **Yedek al:** Ayarlar → "Yedek indir (JSON)" ya da `GET /api/reports/backup`.
  Borçlar, taksit planları, ödemeler, gelir/gider, kategoriler, kurumlar ve ayarlar dahildir.
- **Geri yükle:** Ayarlar → dosya seçip
  - *Ekleyerek*: mevcut kayıtlar korunur, yedektekiler eklenir.
  - *Değiştirerek*: mevcut kayıtlar silinir (çift onay ister).
  Tamamı tek bir transaction içinde çalışır; hata olursa hiçbir şey değişmez.
- **CSV dışa aktarım:** `GET /api/reports/export?type=debts|transactions|summary`
  (Excel uyumu için UTF-8 BOM ve `;` ayracı).

---

## Render.com dağıtımı

1. Bu depoyu GitHub'a gönderin (Render bir git deposu ister).

   ```bash
   git init
   git add .
   git commit -m "İlk sürüm"
   git remote add origin <repo-url>
   git push -u origin main
   ```

2. Render panelinde **New → Blueprint** deyip depoyu seçin. `render.yaml` şunları kurar:
   - `borcolcme-app` (web)
   - `borcolcme-gold-sync` (cron, günde 3 kez)
   - `borcolcme-db` (PostgreSQL)

3. Blueprint uygulanırken şu değişkenler **elle** sorulur:
   - `SEED_USER_EMAIL`
   - `SEED_USER_PASSWORD` (en az 10 karakter)
   - `NEXT_PUBLIC_APP_URL` (örn. `https://borcolcme-app.onrender.com`)

   `JWT_SECRET`, `CRON_SECRET` ve `DATABASE_URL` otomatik üretilir/bağlanır.

4. Build komutu migration'ları uygular ve seed'i çalıştırır:

   ```
   npm ci --include=dev && npx prisma generate && npx prisma migrate deploy && npx prisma db seed && npm run build
   ```

5. Sağlık kontrolü: `/api/health` — veritabanı bağlantısını da test eder,
   Postgres'e ulaşılamıyorsa `503` döner.

### Dikkat edilecekler

- **`NODE_ENV` bilerek tanımlanmamıştır.** `NODE_ENV=production` ayarlandığında `npm ci`
  devDependencies'i atlar; `typescript`, `tailwindcss` ve prisma CLI kurulmadığı için
  build başarısız olur. Render çalışma anında zaten `production` kullanır.
- **Free tier** 15 dakika hareketsizlikte servisi uyutur; ilk açılış 30–60 saniye sürebilir.
  Free PostgreSQL 90 gün sonra sona erer.
- Cron servisi veritabanına doğrudan yazar, web servisine HTTP isteği atmaz;
  bu yüzden `NEXT_PUBLIC_APP_URL`'e ihtiyaç duymaz.

---

## Proje yapısı

```
prisma/
  schema.prisma          Veri modeli
  migrations/            SQL migration'ları (deploy bunları uygular)
  seed.ts                Kurumlar, kategoriler, ayarlar, ilk kullanıcı
src/
  app/                   Sayfalar ve API rotaları
  components/            Arayüz bileşenleri
  lib/
    api/handler.ts       Ortak hata → HTTP dönüşümü
    auth/jwt.ts          Web Crypto tabanlı HS256 oturum jetonu
    db/                  Veritabanı erişim katmanı (yalnızca Prisma)
    finance/             Saf hesaplama fonksiyonları (annüite, KMH, altın, senaryo)
    gold/                Fiyat sağlayıcıları ve çözümleme zinciri
    settings/defaults.ts Oran/marj/tablo varsayılanlarının tek kaynağı
    validation/          Form ve API'nin paylaştığı Zod şemaları
  tests/                 Vitest birim testleri
```

## Testler

```bash
npm test
```

`lib/finance`, `lib/gold`, `lib/auth` ve `lib/validation` katmanları kapsanır;
kabul kriterlerine (21 ayar marjı, 22 ayar marjsızlık, adet bazlı altın, kuruş
kaybı olmaması, gün bazlı KMH faizi) karşılık gelen testler ayrıca işaretlidir.
