import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { paginationOffset } from '../common/pagination.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { ProductRepository } from '../products/domain/product.types.js';
import { PRODUCT_REPOSITORY } from '../products/domain/product.types.js';
import type { CreateInvoiceRecord, InvoiceRecord, InvoiceRepository } from './domain/invoice.types.js';
import { INVOICE_REPOSITORY, InsufficientStockError } from './domain/invoice.types.js';
import { CreateInvoiceDto, ListInvoicesQueryDto } from './dto/invoice.dto.js';

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    private readonly config: AppConfigService,
  ) {}

  async create(userId: string, input: CreateInvoiceDto): Promise<InvoiceRecord> {
    this.validateLineItems(input);
    const products = await Promise.all(input.items.map((item) => this.products.findById(userId, item.productId)));
    if (products.some((product) => product === null)) {
      throw new NotFoundException('One or more products were not found.');
    }

    const items = input.items.map((item, index) => {
      const product = products[index];
      if (product === null || product === undefined) {
        throw new NotFoundException('One or more products were not found.');
      }
      if (item.quantity > product.quantityOnHand) {
        throw new BadRequestException(`Insufficient stock for ${product.name}.`);
      }
      return {
        productId: product.id,
        productName: product.name,
        unitPriceCents: product.unitPriceCents,
        quantity: item.quantity,
        lineTotalCents: product.unitPriceCents * item.quantity,
      };
    });
    const subtotalCents = items.reduce((total, item) => total + item.lineTotalCents, 0);
    const taxAmountCents = Math.round((subtotalCents * this.config.taxRateBasisPoints) / 10000);
    const invoice: CreateInvoiceRecord = {
      userId,
      invoiceNumber: `INV-${new Date().getUTCFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`,
      customerName: input.customerName.trim(),
      issueDate: new Date(input.issueDate),
      dueDate: input.dueDate === undefined ? null : new Date(input.dueDate),
      notes: input.notes?.trim() || null,
      subtotalCents,
      taxAmountCents,
      totalCents: subtotalCents + taxAmountCents,
      items,
    };
    return this.invoices.create(invoice);
  }

  async list(userId: string, query: ListInvoicesQueryDto) {
    const result = await this.invoices.findMany(userId, query.status, paginationOffset(query.page, query.pageSize), query.pageSize);
    return { ...result, page: query.page, pageSize: query.pageSize };
  }

  async get(userId: string, id: string): Promise<InvoiceRecord> {
    return this.requireInvoice(userId, id);
  }

  async changeStatus(userId: string, id: string, status: InvoiceStatus): Promise<InvoiceRecord> {
    const invoice = await this.requireInvoice(userId, id);
    if (invoice.status === InvoiceStatus.DRAFT && status === InvoiceStatus.ISSUED) {
      try {
        if (await this.invoices.issue(userId, id, invoice.items)) {
          return this.requireInvoice(userId, id);
        }
      } catch (error: unknown) {
        if (error instanceof InsufficientStockError) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }
    } else if (invoice.status === InvoiceStatus.ISSUED && status === InvoiceStatus.PAID) {
      if (await this.invoices.transition(userId, id, InvoiceStatus.ISSUED, InvoiceStatus.PAID)) {
        return this.requireInvoice(userId, id);
      }
    } else if (invoice.status === InvoiceStatus.DRAFT && status === InvoiceStatus.CANCELLED) {
      if (await this.invoices.transition(userId, id, InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED)) {
        return this.requireInvoice(userId, id);
      }
    } else if (invoice.status === InvoiceStatus.ISSUED && status === InvoiceStatus.CANCELLED) {
      if (await this.invoices.cancelIssued(userId, id, invoice.items)) {
        return this.requireInvoice(userId, id);
      }
    }
    throw new ConflictException('This invoice status transition is not allowed.');
  }

  private validateLineItems(input: CreateInvoiceDto): void {
    const uniqueProductIds = new Set(input.items.map((item) => item.productId));
    if (uniqueProductIds.size !== input.items.length) {
      throw new BadRequestException('Each product may appear only once on an invoice.');
    }
  }

  private async requireInvoice(userId: string, id: string): Promise<InvoiceRecord> {
    const invoice = await this.invoices.findById(userId, id);
    if (invoice === null) {
      throw new NotFoundException('Invoice not found.');
    }
    return invoice;
  }
}