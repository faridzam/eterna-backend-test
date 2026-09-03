DROP INDEX "StockMovement_productId_reason_key";

CREATE UNIQUE INDEX "StockMovement_invoice_product_reason_unique"
  ON "StockMovement" ("invoiceId", "productId", "reason")
  WHERE "invoiceId" IS NOT NULL;

CREATE UNIQUE INDEX "StockMovement_initial_stock_once"
  ON "StockMovement" ("productId")
  WHERE "reason" = 'INITIAL_STOCK';