-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "currentPrincipalOverride" DECIMAL(18,4),
ADD COLUMN     "principalOverrideAt" TIMESTAMP(3);
