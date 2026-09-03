ALTER TABLE "Product"
  ADD CONSTRAINT "Product_unitPriceCents_nonnegative" CHECK ("unitPriceCents" >= 0),
  ADD CONSTRAINT "Product_quantityOnHand_nonnegative" CHECK ("quantityOnHand" >= 0);

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "InvoiceItem_unitPriceCents_nonnegative" CHECK ("unitPriceCents" >= 0),
  ADD CONSTRAINT "InvoiceItem_lineTotalCents_nonnegative" CHECK ("lineTotalCents" >= 0);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_subtotalCents_nonnegative" CHECK ("subtotalCents" >= 0),
  ADD CONSTRAINT "Invoice_taxAmountCents_nonnegative" CHECK ("taxAmountCents" >= 0),
  ADD CONSTRAINT "Invoice_totalCents_nonnegative" CHECK ("totalCents" >= 0);