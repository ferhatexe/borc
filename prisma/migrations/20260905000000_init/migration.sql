-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('BANKA', 'KATILIM', 'FINANSMAN', 'KISI', 'KURUM', 'DIGER');

-- CreateEnum
CREATE TYPE "DebtType" AS ENUM ('TAKSITLI_KREDI', 'KREDI_KARTI', 'EK_HESAP_KMH', 'ALTIN_BORCU', 'KISI_BORCU', 'SENET_CEK', 'DUZENLI_ODEME', 'DIGER');

-- CreateEnum
CREATE TYPE "LoanSubType" AS ENUM ('IHTIYAC', 'TASIT', 'KONUT', 'EGITIM', 'KOBI');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('AKTIF', 'KAPANDI', 'GECIKMIS', 'ERTELENDI');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('TRY', 'USD', 'EUR', 'XAU');

-- CreateEnum
CREATE TYPE "AccrualBasis" AS ENUM ('GUNLUK');

-- CreateEnum
CREATE TYPE "GoldType" AS ENUM ('GRAM_ALTIN', 'CEYREK', 'YARIM', 'TAM', 'ATA', 'GREMSE', 'BILEZIK_22', 'ZINCIR_21_HALEP', 'BILEZIK_14', 'BILEZIK_18', 'KULCE', 'DIGER');

-- CreateEnum
CREATE TYPE "GoldPriceSource" AS ENUM ('CANLI', 'MANUEL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SENET', 'CEK');

-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('AYLIK', 'UC_AYLIK', 'ALTI_AYLIK', 'YILLIK');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('BEKLIYOR', 'ODENDI', 'GECIKMIS');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('NAKIT', 'HAVALE', 'KART', 'BANKA_KARTI', 'KREDI_KARTI', 'OTOMATIK_ODEME', 'DIGER');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('GELIR', 'GIDER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InstitutionType" NOT NULL DEFAULT 'BANKA',
    "logoUrl" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT,
    "type" "DebtType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "DebtStatus" NOT NULL DEFAULT 'AKTIF',
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "color" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "loanSubType" "LoanSubType",
    "principal" DECIMAL(18,4),
    "interestRateMonthly" DECIMAL(8,4),
    "installmentCount" INTEGER,
    "installmentAmount" DECIMAL(18,4),
    "firstPaymentDate" TIMESTAMP(3),
    "paymentDayOfMonth" INTEGER,
    "paidInstallments" INTEGER DEFAULT 0,
    "includeKKDF" BOOLEAN DEFAULT true,
    "kkdfRate" DECIMAL(5,4) DEFAULT 0.15,
    "includeBSMV" BOOLEAN DEFAULT true,
    "bsmvRate" DECIMAL(5,4) DEFAULT 0.15,
    "earlyPayoffEnabled" BOOLEAN DEFAULT false,
    "loanAccountNo" TEXT,
    "cardName" TEXT,
    "last4" TEXT,
    "creditLimit" DECIMAL(18,4),
    "currentStatementBalance" DECIMAL(18,4),
    "minimumPayment" DECIMAL(18,4),
    "statementDay" INTEGER,
    "dueDay" INTEGER,
    "contractualInterestMonthly" DECIMAL(8,4),
    "overdueInterestMonthly" DECIMAL(8,4),
    "installmentsOnCard" JSONB,
    "limit" DECIMAL(18,4),
    "usedAmount" DECIMAL(18,4),
    "lastInterestChargeDate" TIMESTAMP(3),
    "accrualBasis" "AccrualBasis" DEFAULT 'GUNLUK',
    "goldType" "GoldType",
    "quantity" DECIMAL(12,4),
    "grams" DECIMAL(12,4),
    "karat" INTEGER,
    "priceSource" "GoldPriceSource" DEFAULT 'CANLI',
    "manualUnitPrice" DECIMAL(18,4),
    "premiumTL" DECIMAL(12,4) DEFAULT 0,
    "creditorName" TEXT,
    "dueDate" TIMESTAMP(3),
    "isInterestFree" BOOLEAN DEFAULT true,
    "creditorPhone" TEXT,
    "amount" DECIMAL(18,4),
    "hasInterest" BOOLEAN DEFAULT false,
    "installmentPlan" JSONB,
    "documentType" "DocumentType",
    "documentNo" TEXT,
    "drawee" TEXT,
    "frequency" "PaymentFrequency",
    "nextDueDate" TIMESTAMP(3),
    "autoCreateExpense" BOOLEAN DEFAULT false,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentSchedule" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "principalPart" DECIMAL(18,4) NOT NULL,
    "interestPart" DECIMAL(18,4) NOT NULL,
    "remainingPrincipal" DECIMAL(18,4) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(18,4),

    CONSTRAINT "InstallmentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "installmentId" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL DEFAULT 'HAVALE',
    "principalPart" DECIMAL(18,4),
    "interestPart" DECIMAL(18,4),
    "note" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "note" TEXT,
    "attachmentUrl" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "date" TIMESTAMP(3) NOT NULL,
    "merchant" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'KART',
    "relatedDebtId" TEXT,
    "note" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "parentId" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldPriceSnapshot" (
    "id" TEXT NOT NULL,
    "goldType" "GoldType" NOT NULL,
    "karat" INTEGER NOT NULL,
    "buyPrice" DECIMAL(18,4) NOT NULL,
    "sellPrice" DECIMAL(18,4) NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoldPriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_name_key" ON "Institution"("name");

-- CreateIndex
CREATE INDEX "Debt_userId_status_idx" ON "Debt"("userId", "status");

-- CreateIndex
CREATE INDEX "Debt_institutionId_idx" ON "Debt"("institutionId");

-- CreateIndex
CREATE INDEX "InstallmentSchedule_debtId_status_idx" ON "InstallmentSchedule"("debtId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentSchedule_debtId_installmentNo_key" ON "InstallmentSchedule"("debtId", "installmentNo");

-- CreateIndex
CREATE INDEX "Payment_debtId_idx" ON "Payment"("debtId");

-- CreateIndex
CREATE INDEX "Payment_installmentId_idx" ON "Payment"("installmentId");

-- CreateIndex
CREATE INDEX "Income_userId_date_idx" ON "Income"("userId", "date");

-- CreateIndex
CREATE INDEX "Income_userId_isArchived_idx" ON "Income"("userId", "isArchived");

-- CreateIndex
CREATE INDEX "Expense_userId_date_idx" ON "Expense"("userId", "date");

-- CreateIndex
CREATE INDEX "Expense_userId_isArchived_idx" ON "Expense"("userId", "isArchived");

-- CreateIndex
CREATE INDEX "Expense_relatedDebtId_idx" ON "Expense"("relatedDebtId");

-- CreateIndex
CREATE INDEX "Category_userId_type_idx" ON "Category"("userId", "type");

-- CreateIndex
CREATE INDEX "GoldPriceSnapshot_goldType_fetchedAt_idx" ON "GoldPriceSnapshot"("goldType", "fetchedAt");

-- CreateIndex
CREATE INDEX "GoldPriceSnapshot_fetchedAt_idx" ON "GoldPriceSnapshot"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_userId_key_key" ON "Setting"("userId", "key");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentSchedule" ADD CONSTRAINT "InstallmentSchedule_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "InstallmentSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_relatedDebtId_fkey" FOREIGN KEY ("relatedDebtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

