-- AlterEnum
BEGIN;
CREATE TYPE "PlanTier_new" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'AGENCY');
ALTER TABLE "User" ALTER COLUMN "planTier" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "planTier" TYPE "PlanTier_new" USING ("planTier"::text::"PlanTier_new");
ALTER TYPE "PlanTier" RENAME TO "PlanTier_old";
ALTER TYPE "PlanTier_new" RENAME TO "PlanTier";
DROP TYPE "PlanTier_old";
ALTER TABLE "User" ALTER COLUMN "planTier" SET DEFAULT 'FREE';
COMMIT;

-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "RoutingRule" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "maxStores" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "WebhookEndpoint" ADD COLUMN     "storeId" TEXT;

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Store_userId_idx" ON "Store"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppConfig_key_key" ON "AppConfig"("key");

-- CreateIndex
CREATE INDEX "Order_storeId_status_idx" ON "Order"("storeId", "status");

-- CreateIndex
CREATE INDEX "Order_storeId_source_idx" ON "Order"("storeId", "source");

-- CreateIndex
CREATE INDEX "RoutingRule_storeId_active_idx" ON "RoutingRule"("storeId", "active");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
