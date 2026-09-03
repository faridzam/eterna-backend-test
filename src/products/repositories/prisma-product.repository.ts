import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    return this.prisma.product.create({ data: input });
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
    const result = await this.prisma.product.updateMany({
      where: { id, userId, deletedAt: null },
      data: input,
    });
    return result.count === 0 ? null : this.findById(userId, id);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.product.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count > 0;
  }
}
