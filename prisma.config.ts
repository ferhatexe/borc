import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma yapılandırması.
 *
 * `package.json` içindeki `prisma` alanı Prisma 7'de kaldırılacağı için seed
 * komutu buraya taşındı.
 *
 * Bağlantı adresleri şemada tanımlıdır:
 *   DATABASE_URL -> havuzlu (pooled) adres, uygulama bunu kullanır
 *   DIRECT_URL   -> havuzsuz adres, migration ve introspection bunu kullanır
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
