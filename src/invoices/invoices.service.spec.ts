import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AppConfigService } from '../config/app-config.service.js';
import {
  ProductRecord,
  ProductRepository,
} from '../products/domain/product.types.js';
import {
  CreateInvoiceRecord,
  InvoiceItemRecord,
  InvoicePage,
  InvoiceRecord,
  InvoiceRepository,
} from './domain/invoice.types.js';
import { InvoicesService } from './invoices.service.js';

function createHarness() {
  let product: ProductRecord = {
    id: 'product-1',
    userId: 'user-1',
    sku: 'SF-100',
    name: 'Packing tape',
    description: null,
    unitPriceCents: 350,
    quantityOnHand: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  let invoice: InvoiceRecord | null = null;
  const products: ProductRepository = {
    async create() {
      return product;
    },
    async findById(userId, id) {
      return userId === product.userId && id === product.id ? product : null;
    },
    async findMany() {
      return { items: [product], total: 1 };
    },
    async update() {
      return product;
    },
    async delete() {
      return false;
    },
  };
  const invoices: InvoiceRepository = {
    async create(input: CreateInvoiceRecord) {
      invoice = {
        id: 'invoice-1',
        status: InvoiceStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
        items: input.items.map((item, index) => ({
          id: `item-${index + 1}`,
          invoiceId: 'invoice-1',
          ...item,
        })),
      };
      return invoice;
    },
    async updateDraft(userId, id, input) {
      if (
        invoice === null ||
        invoice.userId !== userId ||
        invoice.id !== id ||
        invoice.status !== InvoiceStatus.DRAFT
      )
        return false;
      invoice = {
        ...invoice,
        ...input,
        items: input.items.map((item, index) => ({
          id: `item-${index + 1}`,
          invoiceId: id,
          ...item,
        })),
      };
      return true;
    },
    async findById(userId, id) {
      return invoice?.userId === userId && invoice.id === id ? invoice : null;
    },
    async findMany(): Promise<InvoicePage> {
      return invoice === null
        ? { items: [], total: 0 }
        : { items: [invoice], total: 1 };
    },
    async issue(userId, id, items: readonly InvoiceItemRecord[]) {
      if (
        invoice === null ||
        invoice.userId !== userId ||
        invoice.id !== id ||
        invoice.status !== InvoiceStatus.DRAFT
      ) {
        return false;
      }
      const quantity = items.reduce((total, item) => total + item.quantity, 0);
      if (product.quantityOnHand < quantity) {
        return false;
      }
      product = {
        ...product,
        quantityOnHand: product.quantityOnHand - quantity,
      };
      invoice = { ...invoice, status: InvoiceStatus.ISSUED };
      return true;
    },
    async transition(userId, id, from, to) {
      if (
        invoice === null ||
        invoice.userId !== userId ||
        invoice.id !== id ||
        invoice.status !== from
      ) {
        return false;
      }
      invoice = { ...invoice, status: to };
      return true;
    },
    async cancelIssued(userId, id, items: readonly InvoiceItemRecord[]) {
      if (
        invoice === null ||
        invoice.userId !== userId ||
        invoice.id !== id ||
        invoice.status !== InvoiceStatus.ISSUED
      ) {
        return false;
      }
      product = {
        ...product,
        quantityOnHand:
          product.quantityOnHand +
          items.reduce((total, item) => total + item.quantity, 0),
      };
      invoice = { ...invoice, status: InvoiceStatus.CANCELLED };
      return true;
    },
  };
  return {
    product: () => product,
    service: new InvoicesService(invoices, products, new AppConfigService()),
  };
}

const invoiceInput = {
  customerName: 'Acme',
  issueDate: '2026-01-01',
  items: [{ productId: 'product-1', quantity: 3 }],
};

describe('InvoicesService', () => {
  it('rejects a draft line that exceeds the owned product stock', async () => {
    const harness = createHarness();
    await expect(
      harness.service.create('user-1', {
        ...invoiceInput,
        items: [{ productId: 'product-1', quantity: 5 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calculates integer-cent totals and ignores client totals', async () => {
    const harness = createHarness();
    const created = await harness.service.create('user-1', {
      ...invoiceInput,
      subtotalCents: 1,
      taxAmountCents: 1,
      totalCents: 1,
    });
    expect(created.subtotalCents).toBe(1050);
    expect(created.taxAmountCents).toBe(116);
    expect(created.totalCents).toBe(1166);
    expect(created.items[0]).toMatchObject({
      productName: 'Packing tape',
      unitPriceCents: 350,
      lineTotalCents: 1050,
    });
  });

  it('replaces draft lines and recalculates snapshots and totals', async () => {
    const harness = createHarness();
    const created = await harness.service.create('user-1', invoiceInput);
    const updated = await harness.service.updateDraft('user-1', created.id, {
      ...invoiceInput,
      customerName: 'Updated customer',
      items: [{ productId: 'product-1', quantity: 2 }],
    });
    expect(updated.customerName).toBe('Updated customer');
    expect(updated.subtotalCents).toBe(700);
    expect(updated.items[0].quantity).toBe(2);
    expect(updated.items[0].unitPriceCents).toBe(350);
  });

  it('decrements stock when issuing and restores it when cancelling', async () => {
    const harness = createHarness();
    const created = await harness.service.create('user-1', invoiceInput);
    const issued = await harness.service.changeStatus(
      'user-1',
      created.id,
      InvoiceStatus.ISSUED,
    );
    expect(issued.status).toBe(InvoiceStatus.ISSUED);
    expect(harness.product().quantityOnHand).toBe(1);

    const cancelled = await harness.service.changeStatus(
      'user-1',
      created.id,
      InvoiceStatus.CANCELLED,
    );
    expect(cancelled.status).toBe(InvoiceStatus.CANCELLED);
    expect(harness.product().quantityOnHand).toBe(4);
  });

  it('does not load another user’s invoice', async () => {
    const harness = createHarness();
    const created = await harness.service.create('user-1', invoiceInput);
    await expect(
      harness.service.get('user-2', created.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects edits to terminal invoices and invalid transitions', async () => {
    const harness = createHarness();
    const created = await harness.service.create('user-1', invoiceInput);
    await harness.service.changeStatus(
      'user-1',
      created.id,
      InvoiceStatus.ISSUED,
    );
    await harness.service.changeStatus(
      'user-1',
      created.id,
      InvoiceStatus.PAID,
    );
    await expect(
      harness.service.updateDraft('user-1', created.id, invoiceInput),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      harness.service.changeStatus(
        'user-1',
        created.id,
        InvoiceStatus.CANCELLED,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
