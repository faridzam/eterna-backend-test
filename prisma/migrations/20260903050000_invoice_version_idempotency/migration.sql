ALTER TABLE "Invoice" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "InvoiceIdempotency" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "responseStatus" INTEGER NOT NULL,
  "responseBody" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "InvoiceIdempotency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoiceIdempotency_userId_operation_invoiceId_key_key"
  ON "InvoiceIdempotency"("userId", "operation", "invoiceId", "key");
CREATE UNIQUE INDEX "InvoiceIdempotency_userId_key_key"
  ON "InvoiceIdempotency"("userId", "key");
CREATE INDEX "InvoiceIdempotency_createdAt_idx" ON "InvoiceIdempotency"("createdAt");
ALTER TABLE "InvoiceIdempotency" ADD CONSTRAINT "InvoiceIdempotency_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceIdempotency" ADD CONSTRAINT "InvoiceIdempotency_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;