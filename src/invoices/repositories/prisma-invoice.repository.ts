import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma, StockMovementReason } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateInvoiceRecord,
  InvoicePage,
  InvoiceRecord,
  InvoiceRepository,
  UpdateDraftInvoiceRecord,
} from '../domain/invoice.types.js';
import {
  IdempotencyConflictError,
  IdempotencyProcessingError,
  InsufficientStockError,
  TransactionConflictError,
} from '../domain/invoice.types.js';

const invoiceWithItems = Prisma.validator<Prisma.InvoiceInclude>()({
  items: true,
});

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateInvoiceRecord): Promise<InvoiceRecord> {
    return this.prisma.invoice.create({
      data: {
        userId: input.userId,
        invoiceNumber: input.invoiceNumber,
        customerName: input.customerName,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        notes: input.notes,
        subtotalCents: input.subtotalCents,
        taxAmountCents: input.taxAmountCents,
        totalCents: input.totalCents,
        items: { create: [...input.items] },
      },
      include: invoiceWithItems,
    });
  }

  async findById(userId: string, id: string): Promise<InvoiceRecord | null> {
    return this.prisma.invoice.findFirst({
      where: { id, userId },
      include: invoiceWithItems,
    });
  }

  async updateDraft(
    userId: string,
    id: string,
    expectedVersion: number,
    idempotencyKey: string,
    fingerprint: string,
    input: UpdateDraftInvoiceRecord,
  ): Promise<InvoiceRecord | null> {
    return this.mutateWithIdempotency(userId, id, 'DRAFT_UPDATE', idempotencyKey, fingerprint, async (transaction) => {
        const updated = await transaction.invoice.updateMany({
          where: { id, userId, status: InvoiceStatus.DRAFT, version: expectedVersion },
          data: {
            customerName: input.customerName,
            issueDate: input.issueDate,
            dueDate: input.dueDate,
            notes: input.notes,
            subtotalCents: input.subtotalCents,
            taxAmountCents: input.taxAmountCents,
            totalCents: input.totalCents,
            version: { increment: 1 },
          },
        });
        if (updated.count === 0) {
          return null;
        }
        await transaction.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await transaction.invoiceItem.createMany({
          data: input.items.map((item) => ({ invoiceId: id, ...item })),
        });
        return transaction.invoice.findFirst({
          where: { id, userId },
          include: invoiceWithItems,
        });
      });
  }

  async findMany(
    userId: string,
    status: InvoiceStatus | undefined,
    skip: number,
    take: number,
  ): Promise<InvoicePage> {
    const where = { userId, ...(status === undefined ? {} : { status }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: invoiceWithItems,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { items, total };
  }

  async findIdempotentResult(
    userId: string,
    id: string,
    operation: string,
    idempotencyKey: string,
    fingerprint: string,
  ): Promise<InvoiceRecord | null> {
    const record = await this.prisma.invoiceIdempotency.findUnique({
      where: {
        userId_key: { userId, key: idempotencyKey },
      },
    });
    if (record === null) return null;
    if (
      record.fingerprint !== fingerprint ||
      record.operation !== operation ||
      record.invoiceId !== id
    ) {
      throw new IdempotencyConflictError();
    }
    if (record.completedAt === null) throw new IdempotencyProcessingError();
    return this.findById(userId, id);
  }

  async issue(userId: string, id: string, expectedVersion: number, idempotencyKey: string, fingerprint: string): Promise<InvoiceRecord | null> {
    return this.mutateWithIdempotency(userId, id, 'STATUS', idempotencyKey, fingerprint, async (transaction) => {
            const invoice = await transaction.invoice.findFirst({
              where: { id, userId, status: InvoiceStatus.DRAFT, version: expectedVersion },
              include: invoiceWithItems,
            });
            if (invoice === null) return null;
            for (const item of invoice.items) {
              const changed = await transaction.product.updateMany({
                where: {
                  id: item.productId,
                  userId,
                  quantityOnHand: { gte: item.quantity },
                },
                data: { quantityOnHand: { decrement: item.quantity } },
              });
              if (changed.count === 0)
                throw new InsufficientStockError(item.productName);
              await transaction.stockMovement.create({
                data: {
                  productId: item.productId,
                  userId,
                  invoiceId: id,
                  quantityDelta: -item.quantity,
                  reason: StockMovementReason.INVOICE_ISSUED,
                },
              });
            }
            const updated = await transaction.invoice.updateMany({
              where: { id, userId, status: InvoiceStatus.DRAFT, version: expectedVersion },
              data: { status: InvoiceStatus.ISSUED, version: { increment: 1 } },
            });
            if (updated.count === 0) {
              throw new TransactionConflictError();
            }
            return transaction.invoice.findFirst({ where: { id, userId }, include: invoiceWithItems });
          }, true);
  }

  async transition(
    userId: string,
    id: string,
    from: InvoiceStatus,
    to: InvoiceStatus,
    expectedVersion: number,
    idempotencyKey: string,
    fingerprint: string,
  ): Promise<InvoiceRecord | null> {
    return this.mutateWithIdempotency(userId, id, 'STATUS', idempotencyKey, fingerprint, async (transaction) => {
      const updated = await transaction.invoice.updateMany({
        where: { id, userId, status: from, version: expectedVersion },
        data: { status: to, version: { increment: 1 } },
      });
      return updated.count === 1
        ? transaction.invoice.findFirst({ where: { id, userId }, include: invoiceWithItems })
        : null;
    });
  }

  async cancelIssued(userId: string, id: string, expectedVersion: number, idempotencyKey: string, fingerprint: string): Promise<InvoiceRecord | null> {
      return this.mutateWithIdempotency(userId, id, 'STATUS', idempotencyKey, fingerprint, async (transaction) => {
          const invoice = await transaction.invoice.findFirst({
            where: { id, userId, status: InvoiceStatus.ISSUED, version: expectedVersion },
            include: invoiceWithItems,
          });
          if (invoice === null) return null;
          for (const item of invoice.items) {
            await transaction.product.updateMany({
              where: { id: item.productId, userId },
              data: { quantityOnHand: { increment: item.quantity } },
            });
            await transaction.stockMovement.create({
              data: {
                productId: item.productId,
                userId,
                invoiceId: id,
                quantityDelta: item.quantity,
                reason: StockMovementReason.INVOICE_CANCELLED,
              },
            });
          }
          const updated = await transaction.invoice.updateMany({
            where: { id, userId, status: InvoiceStatus.ISSUED, version: expectedVersion },
            data: { status: InvoiceStatus.CANCELLED, version: { increment: 1 } },
          });
          if (updated.count === 0) {
            throw new TransactionConflictError();
          }
          return transaction.invoice.findFirst({ where: { id, userId }, include: invoiceWithItems });
        }, true);
  }

  private async mutateWithIdempotency(
    userId: string,
    invoiceId: string,
    operation: string,
    key: string,
    fingerprint: string,
    mutation: (transaction: Prisma.TransactionClient) => Promise<InvoiceRecord | null | false>,
    serializable = false,
  ): Promise<InvoiceRecord | null> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (transaction) => {
          const existing = await transaction.invoiceIdempotency.findUnique({
            where: { userId_key: { userId, key } },
          });
          if (existing !== null) {
            if (existing.fingerprint !== fingerprint || existing.operation !== operation || existing.invoiceId !== invoiceId) throw new IdempotencyConflictError();
            if (existing.completedAt === null) throw new IdempotencyProcessingError();
            return transaction.invoice.findFirst({ where: { id: invoiceId, userId }, include: invoiceWithItems });
          }
          await transaction.invoiceIdempotency.create({
            data: { userId, invoiceId, operation, key, fingerprint, responseStatus: 200 },
          });
          const result = await mutation(transaction);
          if (result === null || result === false) {
            await transaction.invoiceIdempotency.delete({ where: { userId_key: { userId, key } } });
            return null;
          }
          await transaction.invoiceIdempotency.update({
            where: { userId_key: { userId, key } },
            data: { completedAt: new Date(), responseBody: { invoiceId: result.id, version: result.version } },
          });
          return result;
        }, { isolationLevel: serializable ? Prisma.TransactionIsolationLevel.Serializable : undefined });
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const existing = await this.prisma.invoiceIdempotency.findUnique({ where: { userId_key: { userId, key } } });
          if (existing?.fingerprint !== fingerprint || existing.operation !== operation || existing.invoiceId !== invoiceId) throw new IdempotencyConflictError();
          if (existing?.completedAt === null) throw new IdempotencyProcessingError();
          return this.findById(userId, invoiceId);
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new TransactionConflictError();
        throw error;
      }
    }
    throw new TransactionConflictError();
  }
}
