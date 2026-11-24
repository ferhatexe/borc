@AGENTS.md

# borçölçme: Claude için çalışma kuralları

Bu dosya depoda durur ve herkese açıktır: kişisel veri, borç rakamı, e-posta,
şifre YAZILMAZ. Kişisel durum, borçların güncel hâli ve kullanıcı tercihleri
`CLAUDE.local.md` dosyasındadır (yalnız bu bilgisayarda, git'e girmez; Claude
Code onu da otomatik okur). Çalışmaya başlamadan önce ikisini de oku.

## Her oturumun sonunda

Veri ya da kod değiştiyse `CLAUDE.local.md` güncellenir:
- "Güncel durum" bölümü: borç listesi ve toplamlar (canlı veriden, tarihli),
- "Oturum geçmişi": tarih + bir iki satırlık özet (en yeni en üstte),
- "Açık işler": bitmeyenler ve kullanıcıya sorulacaklar.

Bu dosya yine de genel kural değişirse güncellenir (örneğin yeni bir banka
hesaplama kuralı öğrenildiğinde).

## Kullanıcıyla iletişim

- Türkçe, kısa ve net yaz; kullanıcı gayriresmî ve hızlı yazar.
- Kullanıcı "canlıya al" der: iş bitince test et, commit et, gönder, canlıda doğrula.

## Proje

- Next.js 16 (App Router, `src/proxy.ts` = eski middleware), Prisma 6,
  Neon Postgres, Tailwind v4, Vitest. Canlı: https://borc-omega.vercel.app
  (Vercel, `main` dalına push ile otomatik yayın). Depo: github.com/ferhatexe/borc (açık).
- **Yerel ve canlı aynı veritabanını kullanır** (`.env` içindeki
  `DATABASE_URL`). Yerelde çalışan her betik canlı veriyi değiştirir.
- Gizli bilgiler `.env` ve `.env.vercel` içinde (git'e girmez). Değerlerini
  asla sohbete, commit mesajına ya da depodaki bir dosyaya yazma.

## Bu bilgisayar (Windows)

- Bash aracının PATH'inde node olmayabilir: PowerShell'de tam yol kullan:
  `& "C:\Program Files\nodejs\node.exe"`, `npx.cmd`, `npm.cmd`.
- PowerShell boş `""` bağımsız değişkeni yutar; betiğe boş değer geçme.
- Kaynak dosyayı PowerShell `Get-Content`/`Set-Content` ile düzenleme: 5.1 BOM'suz
  UTF-8'i ANSI okuyup Türkçe harfleri bozar ve BOM ekler. Edit aracını kullan.
- Python yok; küçük yardımcı işler için `scripts/tmp/*.ts` + `npx.cmd tsx`.
- Commit mesajını dosyaya yaz, `git commit -F <dosya>` ile ver.
- **Push:** araç kabuğundaki `gh` başka bir GitHub hesabında olabilir. Push'u
  kullanıcının terminal sekmesinden yap (`git push origin main`); orada
  ferhatexe hesabı açık.
- Push'tan önce: `git diff --cached` içinde `postgres://`, `npg_`, `PASSWORD=`,
  `SECRET=`, `neon.tech` ara; e-posta/şifre içeren dosya eklenmediğinden emin ol.

## Veri işlemleri

- Tek seferlik betikler `scripts/tmp/*.ts` altında yazılır,
  `npx.cmd tsx --env-file=.env scripts/tmp/x.ts` ile çalışır, iş bitince silinir.
  Önce kuru çalıştır (kontrol), sonra `--yaz` ile yaz.
- Silmek yerine arşivle (`isArchived: true`); kalıcı silme yalnız kullanıcı açıkça isterse.
- Tarihler UTC öğlen saklanır: `new Date(Date.UTC(y, m - 1, d, 12))`.
- Kurumlar (bankalar) tüm hesaplarda ortaktır; borçlar, harcamalar, kategoriler,
  ayarlar hesaba (`userId`) bağlıdır.
- Kasa: `cash_reset_at` ayarından sonra GİRİLEN gelir/giderleri sayar.
  Kartla harcama kasadan düşmez, karta yazılır.
- Yeni hesap: `scripts/create-account.ts` (kurulum bağlantısı ya da
  `--basit-sifre`). Çıktı dosyası depo DIŞINA yazılır (`C:\WORK\00_INBOX`).

## Banka faiz kuralları (doğrulanmış)

- İşleyen faiz = kalan anapara × aylık oran × gün / 30, üstüne KKDF %15 + BSMV %15 (× 1,30).
  Kapama tutarı = kalan anapara + bu faiz. Uygulamanın değerlemesi bunu yapar.
- Oran planda yazmıyorsa plan satırındaki faizden türet; sonra bankanın verdiği
  "bugünkü borç / kapama" rakamıyla kuruşu kuruşuna sağla.
- QNB: gerçek gün sayar, son ödeme gününden itibaren. "BİRİKEN FAİZ" olan satırda
  anapara payı 0'dır; faiz vade gününe kadar tam işler.
- Garanti: planı 30 günlük aylarla, bugünkü borcu gerçek günle hesaplar.
- İş Bankası (taksitli ek hesap): planın faiz payları aylık sabit; ilk dönem gerçek gün.
- Ödeme sonrası kalan = ödeme anındaki kapama − ödenen (önce faize, sonra anaparaya).
- Erken/ara ödeme yapılmış krediyi bankanın güncel planından yeniden kur.
- **Erken ödenen taksitte banka taksitin tamamını çekmez**, o güne kadarki faiz +
  plandaki anaparayı çeker (QNB ve Garanti). Kullanıcı "taksiti ödedim" derse tutarı
  bankanın güncel planından al; plan gelmeden taksit tutarıyla işlersen teyit gerekir.
- QNB: erken ödemeden sonraki dönemi gerçek günden 1 eksik sayar (ödemenin ertesi
  gününden). Elle bakiyeyi o güne (`principalOverrideAt = ödeme + 1 gün`) koy ki vade
  günü tutarı planla birebir tutsun.
- İş Bankası taksitli ek hesap: erken ödenen taksiti plandaki gibi (tam taksit) sayar,
  sonraki dönemin faizi asıl vadeden başlar. Elle bakiye = plandaki kalan, tarih = vade + 1 gün.
- Garanti: erken ödemeden sonra planı yeniden kurar ("Ödeme Tarihi" sütunlu satır);
  elle bakiye gerekmez, planı yaz, son ödeme gününden faiz işler.

## Altın

- Değer = piyasa fiyatı (Truncgil) + gram/adet başına marj. Marj Ayarlar'da;
  değişince primi eski marjda olan borçlar da güncellenir.
- 21 ayar piyasa fiyatı ≈ gram altın × 0,875. Marjı kuyumcu fiyatından kalibre et.

## Kod

- Testler: `npx.cmd vitest run`; tip: `npx.cmd tsc --noEmit`. Her değişiklikte ikisi de temiz olmalı.
- Açık tema tek tema; Tailwind'in koyu tonları `globals.css`'te açığa çevrilir.
  Yeni bir `…-950/…`, `bg-black/…` gibi alfa sınıfı eklersen açık temadaki karşılığını da ekle.
- Sayı girişleri `NumberField` bileşeniyle (virgül/nokta, kuruş kabul eder).
- Telefon (375 px) düzenini yerelde kontrol et; oturum gerekirse
  oturum çerezini ekleyen küçük bir yerel ara sunucu kullan, şifreyi tarayıcıya yazma.
