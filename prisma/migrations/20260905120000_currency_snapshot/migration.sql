-- CreateTable
CREATE TABLE "CurrencySnapshot" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "buyPrice" DECIMAL(18,6) NOT NULL,
    "sellPrice" DECIMAL(18,6) NOT NULL,
    "changePct" DECIMAL(8,4),
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurrencySnapshot_code_fetchedAt_idx" ON "CurrencySnapshot"("code", "fetchedAt");

-- CreateIndex
CREATE INDEX "CurrencySnapshot_fetchedAt_idx" ON "CurrencySnapshot"("fetchedAt");
