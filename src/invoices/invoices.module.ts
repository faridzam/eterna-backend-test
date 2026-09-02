import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProductsModule } from '../products/products.module.js';
import { INVOICE_REPOSITORY } from './domain/invoice.types.js';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';
import { PrismaInvoiceRepository } from './repositories/prisma-invoice.repository.js';

@Module({
  imports: [AuthModule, ProductsModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    PrismaInvoiceRepository,
    { provide: INVOICE_REPOSITORY, useExisting: PrismaInvoiceRepository },
  ],
})
export class InvoicesModule {}