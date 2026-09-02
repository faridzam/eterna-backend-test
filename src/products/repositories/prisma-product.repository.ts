import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { ProductPage, ProductRecord, ProductRepository } from '../domain/product.types.js';

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductRecord> {
    return this.prisma.product.create({ data: input });
  }

  async findById(userId: string, id: string): Promise<ProductRecord | null> {
    return this.prisma.product.findFirst({ where: { id, userId } });
  }

  async findMany(userId: string, search: string | undefined, skip: number, take: number): Promise<ProductPage> {
    const where = {
      userId,
      ...(search === undefined
        ? {}
        : {
            OR: [
              { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { sku: { contains: search, mode: Prisma.QueryMode.insensitive } },
            ],
          }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total };
  }

  async update(userId: string, id: string, input: Partial<Pick<ProductRecord, 'sku' | 'name' | 'description' | 'unitPriceCents' | 'quantityOnHand'>>): Promise<ProductRecord | null> {
    const result = await this.prisma.product.updateMany({ where: { id, userId }, data: input });
    return result.count === 0 ? null : this.findById(userId, id);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.product.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }
}