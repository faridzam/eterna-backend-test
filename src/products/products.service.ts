import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/domain/auth.types.js';
import { paginationOffset } from '../common/pagination.js';
import type { ProductRepository } from './domain/product.types.js';
import { PRODUCT_REPOSITORY } from './domain/product.types.js';
import {
    CreateProductDto,
    ListProductsQueryDto,
    UpdateProductDto,
} from './dto/product.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
  ) {}

  async create(userId: string, input: CreateProductDto) {
    try {
      return await this.products.create({
        userId,
        sku: input.sku.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        unitPriceCents: input.unitPriceCents,
        quantityOnHand: input.quantityOnHand,
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A product with that SKU already exists.');
      }
      throw error;
    }
  }

  async list(user: AuthenticatedUser, query: ListProductsQueryDto) {
    const search = query.search?.trim() || undefined;
    const result = await this.products.findMany(
      { userId: user.id, role: user.role },
      search,
      paginationOffset(query.page, query.pageSize),
      query.pageSize,
    );
    if (result.total === 0) {
      throw new NotFoundException('No products found.');
    }
    return { ...result, page: query.page, pageSize: query.pageSize };
  }

  async get(userId: string, id: string) {
    return this.requireProduct(userId, id);
  }

  async update(userId: string, id: string, input: UpdateProductDto) {
    const update = {
      ...(input.sku === undefined
        ? {}
        : { sku: input.sku.trim().toUpperCase() }),
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.description === undefined
        ? {}
        : { description: input.description.trim() || null }),
      ...(input.unitPriceCents === undefined
        ? {}
        : { unitPriceCents: input.unitPriceCents }),
      ...(input.quantityOnHand === undefined
        ? {}
        : { quantityOnHand: input.quantityOnHand }),
    };
    if (Object.keys(update).length === 0)
      throw new BadRequestException(
        'At least one product field must be provided.',
      );
    try {
      const product = await this.products.update(userId, id, update);
      if (product === null) {
        throw new NotFoundException('Product not found.');
      }
      return product;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A product with that SKU already exists.');
      }
      throw error;
    }
  }

  async delete(user: AuthenticatedUser, id: string): Promise<void> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'You are not allowed to perform this action.',
      );
    }
    try {
      if (
        !(await this.products.delete({ userId: user.id, role: user.role }, id))
      ) {
        throw new NotFoundException('Product not found.');
      }
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2003') {
        throw new ConflictException(
          'Products referenced by invoices cannot be deleted.',
        );
      }
      throw error;
    }
  }

  private async requireProduct(userId: string, id: string) {
    const product = await this.products.findById(userId, id);
    if (product === null) {
      throw new NotFoundException('Product not found.');
    }
    return product;
  }
}
