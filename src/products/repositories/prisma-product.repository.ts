import { Injectable } from '@nestjs/common';
import { Prisma, StockMovementReason } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
    CreateProductRecord,
    ProductPage,
    ProductRecord,
    ProductRepository,
    UpdateProductRecord,
} from '../domain/product.types.js';

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateProductRecord): Promise<ProductRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const product = await transaction.product.create({ data: input });
      await transaction.stockMovement.create({
        data: {
          productId: product.id,
          userId: product.userId,
          quantityDelta: product.quantityOnHand,
          reason: StockMovementReason.INITIAL_STOCK,
        },
      });
      return product;
    });
  }

  async findById(userId: string, id: string): Promise<ProductRecord | null> {
    return this.prisma.product.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  async findMany(
    userId: string,
    search: string | undefined,
    skip: number,
    take: number,
  ): Promise<ProductPage> {
    const where = {
      userId,
      deletedAt: null,
      ...(search === undefined
        ? {}
        : {
            OR: [
              {
                name: { contains: search, mode: Prisma.QueryMode.insensitive },
              },
              { sku: { contains: search, mode: Prisma.QueryMode.insensitive } },
            ],
          }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total };
  }

  async update(
    userId: string,
    id: string,
    input: UpdateProductRecord,
  ): Promise<ProductRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.product.findFirst({
        where: { id, userId, deletedAt: null },
      });
      if (existing === null) return null;
      const result = await transaction.product.updateMany({
        where: { id, userId, deletedAt: null, updatedAt: existing.updatedAt },
        data: input,
      });
      if (result.count === 0) return null;
      const nextQuantity = input.quantityOnHand ?? existing.quantityOnHand;
      if (nextQuantity !== existing.quantityOnHand) {
        await transaction.stockMovement.create({
          data: {
            productId: id,
            userId,
            quantityDelta: nextQuantity - existing.quantityOnHand,
            reason: StockMovementReason.MANUAL_ADJUSTMENT,
          },
        });
      }
      return transaction.product.findFirst({ where: { id, userId } });
    });
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.product.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count > 0;
  }
}
