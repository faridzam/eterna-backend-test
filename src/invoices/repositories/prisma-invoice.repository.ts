import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateInvoiceRecord,
  InvoiceItemRecord,
  InvoicePage,
  InvoiceRecord,
  InvoiceRepository,
  UpdateDraftInvoiceRecord,
} from '../domain/invoice.types.js';
import {
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
    input: UpdateDraftInvoiceRecord,
  ): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.invoice.updateMany({
          where: { id, userId, status: InvoiceStatus.DRAFT },
          data: {
            customerName: input.customerName,
            issueDate: input.issueDate,
            dueDate: input.dueDate,
            notes: input.notes,
            subtotalCents: input.subtotalCents,
            taxAmountCents: input.taxAmountCents,
            totalCents: input.totalCents,
          },
        });
        if (updated.count === 0) {
          return false;
        }
        await transaction.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await transaction.invoiceItem.createMany({
          data: input.items.map((item) => ({ invoiceId: id, ...item })),
        });
        return true;
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new TransactionConflictError();
      }
      throw error;
    }
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

  async issue(
    userId: string,
    id: string,
    items: readonly InvoiceItemRecord[],
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const invoice = await transaction.invoice.updateMany({
              where: { id, userId, status: InvoiceStatus.DRAFT },
              data: { status: InvoiceStatus.ISSUED },
            });
            if (invoice.count === 0) return false;
            for (const item of items) {
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
            }
            return true;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034' ||
          attempt === 2
        )
          throw error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2034'
            ? new TransactionConflictError()
            : error;
      }
    }
    throw new TransactionConflictError();
  }

  async transition(
    userId: string,
    id: string,
    from: InvoiceStatus,
    to: InvoiceStatus,
  ): Promise<boolean> {
    const updated = await this.prisma.invoice.updateMany({
      where: { id, userId, status: from },
      data: { status: to },
    });
    return updated.count === 1;
  }

  async cancelIssued(
    userId: string,
    id: string,
    items: readonly InvoiceItemRecord[],
  ): Promise<boolean> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const invoice = await transaction.invoice.updateMany({
            where: { id, userId, status: InvoiceStatus.ISSUED },
            data: { status: InvoiceStatus.CANCELLED },
          });
          if (invoice.count === 0) {
            return false;
          }
          for (const item of items) {
            await transaction.product.updateMany({
              where: { id: item.productId, userId },
              data: { quantityOnHand: { increment: item.quantity } },
            });
          }
          return true;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new TransactionConflictError();
      throw error;
    }
  }
}
