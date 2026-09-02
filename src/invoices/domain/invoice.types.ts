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

export class InsufficientStockError extends Error {
  constructor(readonly productName: string) {
    super(`Insufficient stock for ${productName}.`);
  }
}

export const INVOICE_REPOSITORY = Symbol('INVOICE_REPOSITORY');

export interface InvoiceRepository {
  create(input: CreateInvoiceRecord): Promise<InvoiceRecord>;
  findById(userId: string, id: string): Promise<InvoiceRecord | null>;
  findMany(userId: string, status: InvoiceStatus | undefined, skip: number, take: number): Promise<InvoicePage>;
  issue(userId: string, id: string, items: readonly InvoiceItemRecord[]): Promise<boolean>;
  transition(userId: string, id: string, from: InvoiceStatus, to: InvoiceStatus): Promise<boolean>;
  cancelIssued(userId: string, id: string, items: readonly InvoiceItemRecord[]): Promise<boolean>;
}