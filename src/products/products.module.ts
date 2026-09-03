import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PRODUCT_REPOSITORY } from './domain/product.types.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { PrismaProductRepository } from './repositories/prisma-product.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    PrismaProductRepository,
    { provide: PRODUCT_REPOSITORY, useExisting: PrismaProductRepository },
  ],
  exports: [PRODUCT_REPOSITORY],
})
export class ProductsModule {}
