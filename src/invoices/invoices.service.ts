import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { paginationOffset } from '../common/pagination.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { ProductRepository } from '../products/domain/product.types.js';
import { PRODUCT_REPOSITORY } from '../products/domain/product.types.js';
import type {
  InvoiceRecord,
  InvoiceRepository,
} from './domain/invoice.types.js';
import {
  INVOICE_REPOSITORY,
  IdempotencyConflictError,
  IdempotencyProcessingError,
  InsufficientStockError,
  StaleInvoiceVersionError,
  TransactionConflictError,
  type UpdateDraftInvoiceRecord,
} from './domain/invoice.types.js';
import {
  CreateInvoiceDto,
  ListInvoicesQueryDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto.js';

const MAX_POSTGRES_INTEGER = 2_147_483_647;

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    private readonly config: AppConfigService,
  ) {}

  async create(
    userId: string,
    input: CreateInvoiceDto,
  ): Promise<InvoiceRecord> {
    const resolved = await this.resolveInvoice(userId, input);
    return this.invoices.create({
      ...resolved,
      userId,
      invoiceNumber: this.invoiceNumber(),
    });
  }

  async updateDraft(
    userId: string,
    id: string,
    expectedVersion: number,
    idempotencyKey: string,
    fingerprint: string,
    input: UpdateInvoiceDto,
  ): Promise<InvoiceRecord> {
    const requestFingerprint = this.fingerprint(fingerprint);
    const replay = await this.replay(
      userId,
      id,
      'DRAFT_UPDATE',
      idempotencyKey,
      requestFingerprint,
    );
    if (replay) return replay;
    const existing = await this.requireInvoice(userId, id);
    if (existing.version !== expectedVersion) {
      throw new ConflictException(
        'The invoice version is stale. Please reload and retry.',
      );
    }
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException('Only draft invoices can be edited.');
    }
    const updated = await this.invoices.updateDraft(
      userId,
      id,
      expectedVersion,
      idempotencyKey,
      requestFingerprint,
      await this.resolveInvoice(userId, input),
    );
    if (!updated) {
      await this.requireInvoice(userId, id);
      throw new ConflictException('Only draft invoices can be edited.');
    }
    return updated;
  }

  async list(userId: string, query: ListInvoicesQueryDto) {
    const result = await this.invoices.findMany(
      userId,
      query.status,
      paginationOffset(query.page, query.pageSize),
      query.pageSize,
    );
    if (result.total === 0) {
      throw new NotFoundException('No invoices found.');
    }
    return { ...result, page: query.page, pageSize: query.pageSize };
  }

  async get(userId: string, id: string): Promise<InvoiceRecord> {
    return this.requireInvoice(userId, id);
  }

  async changeStatus(
    userId: string,
    id: string,
    status: InvoiceStatus,
    expectedVersion: number,
    idempotencyKey: string,
    fingerprint: string,
  ): Promise<InvoiceRecord> {
    const requestFingerprint = this.fingerprint(fingerprint);
    const replay = await this.replay(
      userId,
      id,
      'STATUS',
      idempotencyKey,
      requestFingerprint,
    );
    if (replay) return replay;
    const invoice = await this.requireInvoice(userId, id);
    if (invoice.version !== expectedVersion) {
      throw new ConflictException(
        'The invoice version is stale. Please reload and retry.',
      );
    }
    if (
      invoice.status === InvoiceStatus.DRAFT &&
      status === InvoiceStatus.ISSUED
    ) {
      try {
        const issued = await this.invoices.issue(
          userId,
          id,
          expectedVersion,
          idempotencyKey,
          requestFingerprint,
        );
        if (issued) {
          return issued;
        }
      } catch (error: unknown) {
        if (error instanceof InsufficientStockError) {
          throw new BadRequestException(error.message);
        }
        if (
          error instanceof TransactionConflictError ||
          error instanceof StaleInvoiceVersionError
        ) {
          throw new ConflictException(error.message);
        }
        if (error instanceof IdempotencyConflictError || error instanceof IdempotencyProcessingError) {
          throw new ConflictException(error.message);
        }
        throw error;
      }
    } else if (
      invoice.status === InvoiceStatus.ISSUED &&
      status === InvoiceStatus.PAID
    ) {
      try {
        const paid = await this.invoices.transition(
          userId,
          id,
          InvoiceStatus.ISSUED,
          InvoiceStatus.PAID,
          expectedVersion,
          idempotencyKey,
          requestFingerprint,
        );
        if (paid) return paid;
      } catch (error: unknown) {
        if (error instanceof IdempotencyConflictError || error instanceof IdempotencyProcessingError) {
          throw new ConflictException(error.message);
        }
        throw error;
      }
    } else if (
      invoice.status === InvoiceStatus.DRAFT &&
      status === InvoiceStatus.CANCELLED
    ) {
      try {
        const cancelledDraft = await this.invoices.transition(
          userId,
          id,
          InvoiceStatus.DRAFT,
          InvoiceStatus.CANCELLED,
          expectedVersion,
          idempotencyKey,
          requestFingerprint,
        );
        if (cancelledDraft) return cancelledDraft;
      } catch (error: unknown) {
        if (error instanceof IdempotencyConflictError || error instanceof IdempotencyProcessingError) {
          throw new ConflictException(error.message);
        }
        throw error;
      }
    } else if (
      invoice.status === InvoiceStatus.ISSUED &&
      status === InvoiceStatus.CANCELLED
    ) {
      try {
        const cancelled = await this.invoices.cancelIssued(
          userId,
          id,
          expectedVersion,
          idempotencyKey,
          requestFingerprint,
        );
        if (cancelled) {
          return cancelled;
        }
      } catch (error: unknown) {
        if (
          error instanceof TransactionConflictError ||
          error instanceof StaleInvoiceVersionError
        ) {
          throw new ConflictException(error.message);
        }
        throw error;
      }
    }
    const current = await this.requireInvoice(userId, id);
    if (current.version !== expectedVersion) {
      throw new ConflictException(
        'The invoice version is stale. Please reload and retry.',
      );
    }
    throw new ConflictException(
      'This invoice status transition is not allowed.',
    );
  }

  private validateLineItems(input: CreateInvoiceDto): void {
    const uniqueProductIds = new Set(input.items.map((item) => item.productId));
    if (uniqueProductIds.size !== input.items.length) {
      throw new BadRequestException(
        'Each product may appear only once on an invoice.',
      );
    }
  }

  private async resolveInvoice(
    userId: string,
    input: CreateInvoiceDto,
  ): Promise<UpdateDraftInvoiceRecord> {
    this.validateLineItems(input);
    const products = await Promise.all(
      input.items.map((item) => this.products.findById(userId, item.productId)),
    );
    const missingIndex = products.findIndex((product) => product === null);
    if (missingIndex >= 0) {
      throw new NotFoundException(
        `Product ${input.items[missingIndex].productId} was not found.`,
      );
    }
    const items = input.items.map((item, index) => {
      const product = products[index];
      if (product === null || product === undefined) {
        throw new NotFoundException(`Product ${item.productId} was not found.`);
      }
      if (item.quantity > product.quantityOnHand) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name}.`,
        );
      }
      return {
        productId: product.id,
        productName: product.name,
        unitPriceCents: product.unitPriceCents,
        quantity: item.quantity,
        lineTotalCents: this.storableCents(
          product.unitPriceCents * item.quantity,
        ),
      };
    });
    const subtotalCents = items.reduce(
      (total, item) => this.storableCents(total + item.lineTotalCents),
      0,
    );
    const taxAmountCents = this.storableCents(
      Math.round(
        (subtotalCents * this.config.taxRateBasisPoints) / 10_000,
      ),
    );
    return {
      customerName: input.customerName.trim(),
      issueDate: new Date(input.issueDate),
      dueDate: input.dueDate === undefined ? null : new Date(input.dueDate),
      notes: input.notes?.trim() || null,
      subtotalCents,
      taxAmountCents,
      totalCents: this.storableCents(subtotalCents + taxAmountCents),
      items,
    };
  }

  private storableCents(value: number): number {
    if (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > MAX_POSTGRES_INTEGER
    ) {
      throw new BadRequestException(
        'Invoice amounts exceed the maximum supported integer-cent value.',
      );
    }
    return value;
  }

  private invoiceNumber(): string {
    return `INV-${new Date().getUTCFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`;
  }

  private fingerprint(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  private async replay(
    userId: string,
    id: string,
    operation: string,
    key: string,
    fingerprint: string,
  ): Promise<InvoiceRecord | null> {
    try {
      return await this.invoices.findIdempotentResult(
        userId,
        id,
        operation,
        key,
        fingerprint,
      );
    } catch (error: unknown) {
      if (
        error instanceof IdempotencyConflictError ||
        error instanceof IdempotencyProcessingError
      ) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  private async requireInvoice(
    userId: string,
    id: string,
  ): Promise<InvoiceRecord> {
    const invoice = await this.invoices.findById(userId, id);
    if (invoice === null) {
      throw new NotFoundException('Invoice not found.');
    }
    return invoice;
  }
}
