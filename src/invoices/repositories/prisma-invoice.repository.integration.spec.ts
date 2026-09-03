import { InvoiceStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaInvoiceRepository } from './prisma-invoice.repository.js';

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error(
    'INTEGRATION_DATABASE_URL is required and must point to an isolated disposable test database.',
  );
}
const testDatabaseName = new URL(databaseUrl).pathname.slice(1);

if (!testDatabaseName.endsWith('_test')) {
  throw new Error(
    'INTEGRATION_DATABASE_URL must point to a database whose name ends with _test.',
  );
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

describe('Prisma invoice integration', () => {
  const repository = new PrismaInvoiceRepository(prisma);

  beforeEach(async () => {
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('issues atomically, decrementing stock and rolling back all lines on failure', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Integration User',
        email: 'integration@example.com',
        passwordHash: 'not-used',
      },
    });
    const first = await prisma.product.create({
      data: {
        userId: user.id,
        sku: 'IT-1',
        name: 'First product',
        unitPriceCents: 100,
        quantityOnHand: 5,
      },
    });
    const second = await prisma.product.create({
      data: {
        userId: user.id,
        sku: 'IT-2',
        name: 'Second product',
        unitPriceCents: 200,
        quantityOnHand: 1,
      },
    });
    const invoice = await repository.create({
      userId: user.id,
      invoiceNumber: 'INV-INTEGRATION-1',
      customerName: 'Integration customer',
      issueDate: new Date('2026-01-01'),
      dueDate: null,
      notes: null,
      subtotalCents: 700,
      taxAmountCents: 77,
      totalCents: 777,
      items: [
        {
          productId: first.id,
          productName: first.name,
          unitPriceCents: first.unitPriceCents,
          quantity: 2,
          lineTotalCents: 200,
        },
        {
          productId: second.id,
          productName: second.name,
          unitPriceCents: second.unitPriceCents,
          quantity: 1,
          lineTotalCents: 200,
        },
      ],
    });

    await expect(
      repository.issue(user.id, invoice.id),
    ).resolves.toBe(true);
    await expect(
      prisma.product.findUnique({ where: { id: first.id } }),
    ).resolves.toMatchObject({ quantityOnHand: 3 });
    await expect(
      prisma.product.findUnique({ where: { id: second.id } }),
    ).resolves.toMatchObject({ quantityOnHand: 0 });
    await expect(
      prisma.stockMovement.findMany({
        where: { invoiceId: invoice.id },
        orderBy: { productId: 'asc' },
      }),
    ).resolves.toHaveLength(2);

    await expect(repository.cancelIssued(user.id, invoice.id)).resolves.toBe(
      true,
    );
    await expect(
      prisma.product.findUnique({ where: { id: first.id } }),
    ).resolves.toMatchObject({ quantityOnHand: 5 });
    await expect(
      prisma.product.findUnique({ where: { id: second.id } }),
    ).resolves.toMatchObject({ quantityOnHand: 1 });
    await expect(
      prisma.stockMovement.count({
        where: { invoiceId: invoice.id, reason: 'INVOICE_CANCELLED' },
      }),
    ).resolves.toBe(2);

    const failingInvoice = await repository.create({
      userId: user.id,
      invoiceNumber: 'INV-INTEGRATION-2',
      customerName: 'Integration customer',
      issueDate: new Date('2026-01-01'),
      dueDate: null,
      notes: null,
      subtotalCents: 300,
      taxAmountCents: 33,
      totalCents: 333,
      items: [
        {
          productId: first.id,
          productName: first.name,
          unitPriceCents: first.unitPriceCents,
          quantity: 99,
          lineTotalCents: 9900,
        },
      ],
    });
    await expect(
      repository.issue(user.id, failingInvoice.id),
    ).rejects.toThrow();
    await expect(
      prisma.invoice.findUnique({ where: { id: failingInvoice.id } }),
    ).resolves.toMatchObject({ status: InvoiceStatus.DRAFT });
    await expect(
      prisma.product.findUnique({ where: { id: first.id } }),
    ).resolves.toMatchObject({ quantityOnHand: 5 });
    await expect(
      prisma.stockMovement.count({ where: { invoiceId: failingInvoice.id } }),
    ).resolves.toBe(0);
  });

  it('does not issue the same invoice twice concurrently', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Concurrent User',
        email: 'concurrent@example.com',
        passwordHash: 'not-used',
      },
    });
    const product = await prisma.product.create({
      data: {
        userId: user.id,
        sku: 'CONCURRENT-1',
        name: 'Concurrent product',
        unitPriceCents: 100,
        quantityOnHand: 1,
      },
    });
    const invoice = await repository.create({
      userId: user.id,
      invoiceNumber: 'INV-CONCURRENT-1',
      customerName: 'Concurrent customer',
      issueDate: new Date('2026-01-01'),
      dueDate: null,
      notes: null,
      subtotalCents: 100,
      taxAmountCents: 11,
      totalCents: 111,
      items: [
        {
          productId: product.id,
          productName: product.name,
          unitPriceCents: product.unitPriceCents,
          quantity: 1,
          lineTotalCents: 100,
        },
      ],
    });

    const results = await Promise.allSettled([
      repository.issue(user.id, invoice.id),
      repository.issue(user.id, invoice.id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled' && result.value)).toHaveLength(1);
    await expect(
      prisma.product.findUnique({ where: { id: product.id } }),
    ).resolves.toMatchObject({ quantityOnHand: 0 });
    await expect(
      prisma.stockMovement.count({ where: { invoiceId: invoice.id } }),
    ).resolves.toBe(1);
  });
});
