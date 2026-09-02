CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Product_active_name_trgm_idx"
ON "Product" USING GIN ("name" gin_trgm_ops)
WHERE "deletedAt" IS NULL;

CREATE INDEX "Product_active_sku_trgm_idx"
ON "Product" USING GIN ("sku" gin_trgm_ops)
WHERE "deletedAt" IS NULL;

CREATE INDEX "Product_active_listing_idx"
ON "Product" ("userId", "createdAt" DESC, "id" DESC)
WHERE "deletedAt" IS NULL;
