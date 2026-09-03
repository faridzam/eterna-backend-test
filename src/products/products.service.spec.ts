import {
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import type {
    CreateProductRecord,
    ProductRecord,
    ProductRepository,
    ProductScope,
    UpdateProductRecord,
} from './domain/product.types.js';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto.js';
import { ProductsService } from './products.service.js';

const dates = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const makeProduct = (
  overrides: Partial<ProductRecord> = {},
): ProductRecord => ({
  id: 'product-1',
  userId: 'user-1',
  sku: 'SF-100',
  name: 'Packing tape',
  description: null,
  unitPriceCents: 350,
  quantityOnHand: 4,
  deletedAt: null,
  owner: { id: 'user-1', name: 'Owner', email: 'owner@example.com' },
  ...dates,
  ...overrides,
});

function harness(initial: ProductRecord[] = [makeProduct()]) {
  const rows = [...initial];
  const repository: ProductRepository = {
    async create(input: CreateProductRecord) {
      if (
        rows.some(
          (row) =>
            row.userId === input.userId &&
            row.deletedAt === null &&
            row.sku === input.sku,
        )
      )
        throw Object.assign(new Error(), { code: 'P2002' });
      const created = makeProduct({
        ...input,
        id: `product-${rows.length + 1}`,
      });
      rows.push(created);
      return created;
    },
    async findById(userId, id) {
      return (
        rows.find(
          (row) =>
            row.userId === userId && row.id === id && row.deletedAt === null,
        ) ?? null
      );
    },
    async findMany(scope: ProductScope, search, skip, take) {
      const active = rows.filter(
        (row) =>
          (scope.role === 'ADMIN' || row.userId === scope.userId) &&
          row.deletedAt === null &&
          (search === undefined ||
            row.name.toLowerCase().includes(search.toLowerCase()) ||
            row.sku.toLowerCase().includes(search.toLowerCase())),
      );
      return { items: active.slice(skip, skip + take), total: active.length };
    },
    async update(userId, id, input: UpdateProductRecord) {
      const index = rows.findIndex(
        (row) =>
          row.userId === userId && row.id === id && row.deletedAt === null,
      );
      if (index < 0) return null;
      rows[index] = { ...rows[index], ...input };
      return rows[index];
    },
    async delete(scope, id) {
      const row = rows.find(
        (candidate) =>
          (scope.role === 'ADMIN' || candidate.userId === scope.userId) &&
          candidate.id === id &&
          candidate.deletedAt === null,
      );
      if (row === undefined) return false;
      row.deletedAt = new Date();
      return true;
    },
  };
  return { rows, service: new ProductsService(repository) };
}

const admin = {
  id: 'user-1',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
  createdAt: dates.createdAt,
};
const staff = { ...admin, role: 'STAFF' as const };

describe('ProductsService', () => {
  it('creates trimmed uppercase SKUs', async () => {
    const result = await harness([]).service.create('user-1', {
      sku: ' sf-200 ',
      name: ' Box ',
      unitPriceCents: 225,
      quantityOnHand: 8,
    });
    expect(result).toMatchObject({ sku: 'SF-200', name: 'Box' });
  });
  it('rejects duplicates and permits reuse after soft deletion', async () => {
    const current = harness();
    await expect(
      current.service.create('user-1', {
        sku: 'sf-100',
        name: 'Duplicate',
        unitPriceCents: 1,
        quantityOnHand: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await current.service.delete(admin, 'product-1');
    await expect(
      current.service.create('user-1', {
        sku: 'sf-100',
        name: 'Replacement',
        unitPriceCents: 1,
        quantityOnHand: 1,
      }),
    ).resolves.toMatchObject({ sku: 'SF-100' });
  });
  it('filters deleted products and supports search and pagination', async () => {
    const current = harness([
      makeProduct(),
      makeProduct({ id: 'product-2', sku: 'BOX-200', name: 'Shipping box' }),
      makeProduct({ id: 'product-3', deletedAt: new Date() }),
    ]);
    expect(
      (await current.service.list(staff, { page: 1, pageSize: 1 })).total,
    ).toBe(2);
    expect(
      (await current.service.list(staff, { page: 2, pageSize: 1 })).items[0]
        ?.sku,
    ).toBe('BOX-200');
    expect(
      (
        await current.service.list(staff, {
          page: 1,
          pageSize: 20,
          search: 'box',
        })
      ).items[0]?.sku,
    ).toBe('BOX-200');
  });
  it('returns not found for foreign and deleted products', async () => {
    const current = harness([
      makeProduct(),
      makeProduct({
        id: 'product-2',
        userId: 'user-2',
        owner: { id: 'user-2', name: 'Staff', email: 'staff@example.com' },
      }),
      makeProduct({ id: 'product-3', deletedAt: new Date() }),
    ]);
    await expect(
      current.service.get('user-2', 'product-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      current.service.update('user-1', 'product-3', { name: 'Nope' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      current.service.delete(admin, 'product-3'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('preserves the row when soft deleting for invoice references', async () => {
    const current = harness();
    await current.service.delete(admin, 'product-1');
    expect(current.rows).toHaveLength(1);
    expect(current.rows[0]?.deletedAt).toBeInstanceOf(Date);
    expect(current.rows[0]?.id).toBe('product-1');
  });
  it('rejects whitespace-only SKU and name', async () => {
    const createErrors = await validate(
      plainToInstance(CreateProductDto, {
        sku: ' ',
        name: '\t',
        unitPriceCents: 0,
        quantityOnHand: 0,
      }),
    );
    const updateErrors = await validate(
      plainToInstance(UpdateProductDto, { sku: ' ', name: ' ' }),
    );
    expect(createErrors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['sku', 'name']),
    );
    expect(updateErrors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['sku', 'name']),
    );
  });
  it('lets admins list every active product with sanitized owners', async () => {
    const current = harness([
      makeProduct(),
      makeProduct({ id: 'product-2', userId: 'user-2' }),
    ]);
    const result = await current.service.list(admin, { page: 1, pageSize: 20 });
    expect(result.total).toBe(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'product-1',
          owner: { id: 'user-1', name: 'Owner', email: 'owner@example.com' },
        }),
        expect.objectContaining({
          id: 'product-2',
          owner: { id: 'user-1', name: 'Owner', email: 'owner@example.com' },
        }),
      ]),
    );
  });
  it('lets admins delete staff products and forbids staff deletion', async () => {
    const current = harness([makeProduct({ userId: 'user-2' })]);
    await expect(
      current.service.delete(staff, 'product-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      current.service.delete(admin, 'product-1'),
    ).resolves.toBeUndefined();
    expect(current.rows[0]?.deletedAt).toBeInstanceOf(Date);
  });
});
