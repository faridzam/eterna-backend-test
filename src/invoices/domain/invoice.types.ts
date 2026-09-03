import { InvoiceStatus } from '@prisma/client';

export interface InvoiceItemRecord {
  readonly id: string;
  readonly invoiceId: string;
  readonly productId: string;
  readonly productName: string;
  readonly unitPriceCents: number;
  readonly quantity: number;
  readonly lineTotalCents: number;
}

export interface InvoiceRecord {
  readonly id: string;
  readonly userId: string;
  readonly invoiceNumber: string;
  readonly customerName: string;
  readonly issueDate: Date;
  readonly dueDate: Date | null;
  readonly status: InvoiceStatus;
  readonly version: number;
  readonly notes: string | null;
  readonly subtotalCents: number;
  readonly taxAmountCents: number;
  readonly totalCents: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly items: readonly InvoiceItemRecord[];
}

export interface InvoicePage {
  readonly items: readonly InvoiceRecord[];
  readonly total: number;
}

export interface CreateInvoiceRecord {
  readonly userId: string;
  readonly invoiceNumber: string;
  readonly customerName: string;
  readonly issueDate: Date;
  readonly dueDate: Date | null;
  readonly notes: string | null;
  readonly subtotalCents: number;
  readonly taxAmountCents: number;
  readonly totalCents: number;
  readonly items: readonly Omit<InvoiceItemRecord, 'id' | 'invoiceId'>[];
}

export type UpdateDraftInvoiceRecord = Pick<
  CreateInvoiceRecord,
  | 'customerName'
  | 'issueDate'
  | 'dueDate'
  | 'notes'
  | 'subtotalCents'
  | 'taxAmountCents'
  | 'totalCents'
  | 'items'
>;

export class InsufficientStockError extends Error {
  constructor(readonly productName: string) {
    super(`Insufficient stock for ${productName}.`);
  }
}

export class TransactionConflictError extends Error {
  constructor() {
    super('The invoice changed while it was being updated. Please retry.');
  }
}

export class StaleInvoiceVersionError extends Error {
  constructor() {
    super('The invoice version is stale. Please reload and retry.');
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('This idempotency key was already used for a different request.');
  }
}

export class IdempotencyProcessingError extends Error {
  constructor() {
    super('An equivalent request is already being processed. Please retry.');
  }
}

export const INVOICE_REPOSITORY = Symbol('INVOICE_REPOSITORY');

export interface InvoiceRepository {
  create(input: CreateInvoiceRecord): Promise<InvoiceRecord>;
  updateDraft(
    userId: string,
    id: string,
    expectedVersion: number,
    idempotencyKey: string,
    fingerprint: string,
    input: UpdateDraftInvoiceRecord,
  ): Promise<InvoiceRecord | null>;
  findById(userId: string, id: string): Promise<InvoiceRecord | null>;
  findMany(
    userId: string,
    status: InvoiceStatus | undefined,
    skip: number,
    take: number,
  ): Promise<InvoicePage>;
  findIdempotentResult(
    userId: string,
    id: string,
    operation: string,
    idempotencyKey: string,
    fingerprint: string,
  ): Promise<InvoiceRecord | null>;
  issue(
    userId: string,
    id: string,
    expectedVersion: number,
    idempotencyKey: string,
    fingerprint: string,
  ): Promise<InvoiceRecord | null>;
  transition(
    userId: string,
    id: string,
    from: InvoiceStatus,
    to: InvoiceStatus,
    expectedVersion: number,
    idempotencyKey: string,
    fingerprint: string,
  ): Promise<InvoiceRecord | null>;
  cancelIssued(
    userId: string,
    id: string,
    expectedVersion: number,
    idempotencyKey: string,
    fingerprint: string,
  ): Promise<InvoiceRecord | null>;
}
