ALTER TABLE "Product" ADD COLUMN "deletedAt" TIMESTAMP(3);
DROP INDEX "Product_userId_sku_key";
CREATE UNIQUE INDEX "Product_userId_sku_active_key" ON "Product"("userId", "sku") WHERE "deletedAt" IS NULL;
CREATE INDEX "Product_userId_deletedAt_idx" ON "Product"("userId", "deletedAt");