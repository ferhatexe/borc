// Prisma Seed Script (Kurumlar, Kategoriler, Ayarlar ve İlk Yönetici)
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTING_VALUES } from "../src/lib/settings/defaults";

const INSTITUTIONS = [
  { name: "QNB Finansbank", type: "BANKA" as const, color: "#8B0000" },
  { name: "Ziraat Bankası", type: "BANKA" as const, color: "#E30613" },
  { name: "Garanti BBVA", type: "BANKA" as const, color: "#008542" },
  { name: "Yapı Kredi", type: "BANKA" as const, color: "#004B93" },
  { name: "Akbank", type: "BANKA" as const, color: "#ED1C24" },
  { name: "Türkiye İş Bankası", type: "BANKA" as const, color: "#003A6F" },
  { name: "Halkbank", type: "BANKA" as const, color: "#007DC5" },
  { name: "VakıfBank", type: "BANKA" as const, color: "#F7A800" },
  { name: "Enpara.com", type: "BANKA" as const, color: "#7B2C82" },
  { name: "ING", type: "BANKA" as const, color: "#FF6200" },
  { name: "TEB", type: "BANKA" as const, color: "#00965E" },
  { name: "DenizBank", type: "BANKA" as const, color: "#005596" },
  { name: "Şekerbank", type: "BANKA" as const, color: "#009845" },
  { name: "Albaraka Türk", type: "KATILIM" as const, color: "#BD1B21" },
  { name: "Kuveyt Türk", type: "KATILIM" as const, color: "#006B3F" },
  { name: "Ziraat Katılım", type: "KATILIM" as const, color: "#C8102E" },
  { name: "Vakıf Katılım", type: "KATILIM" as const, color: "#E2001A" },
  { name: "Emlak Katılım", type: "KATILIM" as const, color: "#004990" },
  { name: "Papara", type: "FINANSMAN" as const, color: "#9333EA" },
  { name: "Getir Finans", type: "FINANSMAN" as const, color: "#5C3EBC" },
  { name: "Diğer", type: "DIGER" as const, color: "#71717A" },
];

const INCOME_CATEGORIES = [
  { name: "Maaş", icon: "Money", color: "#10B981" },
  { name: "Ek Gelir", icon: "PlusCircle", color: "#059669" },
  { name: "Serbest/Freelance", icon: "Briefcase", color: "#0D9488" },
  { name: "İşyeri Geliri", icon: "Buildings", color: "#0284C7" },
  { name: "Kira Geliri", icon: "HouseLine", color: "#2563EB" },
  { name: "Prim/İkramiye", icon: "Gift", color: "#7C3AED" },
  { name: "Satış Geliri", icon: "ShoppingCart", color: "#C026D3" },
  { name: "Faiz/Temettü", icon: "ChartLineUp", color: "#059669" },
  { name: "Borç Tahsilatı", icon: "HandCoins", color: "#16A34A" },
  { name: "İade", icon: "ArrowCounterClockwise", color: "#64748B" },
  { name: "Hediye", icon: "HeartHandshake", color: "#DB2777" },
  { name: "Diğer Gelir", icon: "DotsThreeCircle", color: "#94A3B8" },
];

const EXPENSE_CATEGORIES = [
  {
    name: "Konut",
    icon: "House",
    color: "#3B82F6",
    subs: ["Kira", "Aidat", "Elektrik", "Su", "Doğalgaz", "İnternet", "Tadilat"],
  },
  {
    name: "Market & Gıda",
    icon: "ShoppingCart",
    color: "#F59E0B",
    subs: ["Market", "Manav/Kasap", "Dışarıda Yemek", "Kahve"],
  },
  {
    name: "Ulaşım",
    icon: "Car",
    color: "#6366F1",
    subs: ["Yakıt", "Toplu Taşıma", "Taksi", "Otopark", "Köprü/Otoyol", "Araç Bakım", "Sigorta/Kasko", "MTV"],
  },
  {
    name: "Borç Ödemesi",
    icon: "CreditCard",
    color: "#EF4444",
    subs: ["Kredi Taksiti", "Kredi Kartı", "Ek Hesap Faizi", "Kişi Borcu", "Altın Borcu"],
  },
  {
    name: "Sağlık",
    icon: "FirstAid",
    color: "#EC4899",
    subs: ["İlaç", "Doktor", "Diş", "Gözlük"],
  },
  {
    name: "Eğitim",
    icon: "GraduationCap",
    color: "#8B5CF6",
    subs: ["Okul/Harç", "Kurs", "Kitap"],
  },
  {
    name: "Giyim",
    icon: "TShirt",
    color: "#14B8A6",
    subs: ["Giyim", "Ayakkabı"],
  },
  {
    name: "Telefon & Abonelik",
    icon: "DeviceMobile",
    color: "#06B6D4",
    subs: ["GSM", "Streaming", "Yazılım/Bulut"],
  },
  {
    name: "Kişisel",
    icon: "User",
    color: "#A855F7",
    subs: ["Kuaför", "Spor", "Hobi"],
  },
  {
    name: "Aile & Sosyal",
    icon: "UsersThree",
    color: "#F43F5E",
    subs: ["Çocuk", "Hediye", "Düğün/Nişan", "Bağış"],
  },
  {
    name: "İşletme Giderleri",
    icon: "Briefcase",
    color: "#475569",
    subs: ["Stok Alımı", "Kargo", "Reklam", "Muhasebe", "Vergi/SGK"],
  },
  {
    name: "Diğer Giderler",
    icon: "DotsThree",
    color: "#64748B",
    subs: ["Beklenmedik", "Sınıflandırılmamış"],
  },
];

async function main() {
  console.log("🌱 Veritabanı tohumlama (seed) başlatılıyor...");

  // 1. Varsayılan Kullanıcı
  // Kimlik bilgileri ortam değişkenlerinden ZORUNLU olarak okunur. Koda gömülü
  // bir varsayılan şifre, ayarlanmadığı her kurulumda açık kapı bırakırdı.
  const seedEmail = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  const seedPassword = process.env.SEED_USER_PASSWORD;

  if (!seedEmail || !seedPassword) {
    throw new Error(
      "SEED_USER_EMAIL ve SEED_USER_PASSWORD tanımlanmadan seed çalıştırılamaz."
    );
  }
  if (seedPassword.length < 10) {
    throw new Error("SEED_USER_PASSWORD en az 10 karakter olmalıdır.");
  }

  const passwordHash = await bcrypt.hash(seedPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: seedEmail },
    // Şifre her seed çalıştırmasında ortam değişkeniyle senkronlanır.
    update: { passwordHash },
    create: {
      email: seedEmail,
      passwordHash,
      name: "Yönetici",
      currency: "TRY",
    },
  });
  console.log(`✓ Seed kullanıcısı hazır: ${user.email}`);

  // 2. Kurumlar (Bankalar)
  for (const inst of INSTITUTIONS) {
    await prisma.institution.upsert({
      where: { name: inst.name },
      update: { type: inst.type, color: inst.color },
      create: inst,
    });
  }
  console.log(`✓ ${INSTITUTIONS.length} kurum hazırlandı.`);

  // 3. Gelir Kategorileri
  for (const cat of INCOME_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { userId: user.id, name: cat.name, type: "GELIR", parentId: null },
    });
    if (!existing) {
      await prisma.category.create({
        data: {
          name: cat.name,
          type: "GELIR",
          icon: cat.icon,
          color: cat.color,
          isSystem: true,
          userId: user.id,
        },
      });
    }
  }

  // 4. Gider Kategorileri ve Alt Kategorileri
  for (const cat of EXPENSE_CATEGORIES) {
    let parent = await prisma.category.findFirst({
      where: { userId: user.id, name: cat.name, type: "GIDER", parentId: null },
    });

    if (!parent) {
      parent = await prisma.category.create({
        data: {
          name: cat.name,
          type: "GIDER",
          icon: cat.icon,
          color: cat.color,
          isSystem: true,
          userId: user.id,
        },
      });
    }

    for (const sub of cat.subs) {
      const existingSub = await prisma.category.findFirst({
        where: { userId: user.id, name: sub, type: "GIDER", parentId: parent.id },
      });
      if (!existingSub) {
        await prisma.category.create({
          data: {
            name: sub,
            type: "GIDER",
            parentId: parent.id,
            isSystem: true,
            userId: user.id,
          },
        });
      }
    }
  }
  console.log("✓ Gelir ve Gider kategorileri oluşturuldu.");

  // 5. Varsayılan Sistem Ayarları
  // Oranlar/marjlar tek kaynaktan (src/lib/settings/defaults.ts) gelir; uygulama
  // bu değerleri çalışma anında Setting tablosundan okur.
  for (const [key, value] of Object.entries(DEFAULT_SETTING_VALUES)) {
    await prisma.setting.upsert({
      where: { userId_key: { userId: user.id, key } },
      // Mevcut kurulumdaki kullanıcı ayarları ezilmez, yalnızca eksikler eklenir.
      update: {},
      create: { userId: user.id, key, value: value as never },
    });
  }
  console.log("✓ Varsayılan ayarlar kaydedildi.");
  console.log("🚀 Seed işlemi başarıyla tamamlandı.");
}

main()
  .catch((e) => {
    console.error("Seed hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
