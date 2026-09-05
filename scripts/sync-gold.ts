/**
 * Render cron job: refreshes the gold price snapshot.
 * Runs three times a day (09:00, 13:00, 17:00 TRT).
 *
 * It talks to the database directly instead of calling the web service over
 * HTTP. The old version fetched NEXT_PUBLIC_APP_URL, which the cron service was
 * never given, so every run silently hit http://localhost:3000 and failed.
 */
import { getGoldPrices } from "../src/lib/gold/goldService";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Altın fiyat senkronizasyonu başladı:", new Date().toISOString());

  const result = await getGoldPrices(true);

  console.log(
    `Kaynak: ${result.source} (${result.sourceKind}) | ${result.prices.length} ürün | ` +
      `gram has altın satış: ${result.pureGramSellTL} TL`
  );
  if (result.warning) console.warn("Uyarı:", result.warning);

  if (result.sourceKind !== "LIVE") {
    // Exit non-zero so the failure is visible in the Render dashboard.
    throw new Error("Canlı sağlayıcılardan fiyat alınamadı; snapshot güncellenmedi.");
  }

  console.log("Altın fiyatları güncellendi.");
}

main()
  .catch((error) => {
    console.error("Altın fiyat güncelleme hatası:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
