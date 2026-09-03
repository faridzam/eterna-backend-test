import { StockMovementReason } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { seedProducts } from './seed-products.js';

describe('seedProducts', () => {
  it('upserts each product and creates a missing initial stock movement', async () => {
    const productUpsert = vi.fn().mockResolvedValue({ id: 'product-1' });
    const movementFindFirst = vi.fn().mockResolvedValue(null);
    const movementCreate = vi.fn().mockResolvedValue({ id: 'movement-1' });
    await seedProducts(
      {
        product: { upsert: productUpsert },
        stockMovement: {
          findFirst: movementFindFirst,
          create: movementCreate,
        },
      },
      [
        {
          userId: 'user-1',
          sku: 'SF-100',
          name: 'Packing tape',
          description: 'Clear packing tape roll',
          unitPriceCents: 350,
          quantityOnHand: 40,
        },
      ],
    );

    expect(productUpsert).toHaveBeenCalledWith({
      where: { userId_sku: { userId: 'user-1', sku: 'SF-100' } },
      update: {},
      create: expect.objectContaining({ sku: 'SF-100' }),
    });
    expect(movementFindFirst).toHaveBeenCalledWith({
      where: {
        productId: 'product-1',
        reason: StockMovementReason.INITIAL_STOCK,
      },
    });
    expect(movementCreate).toHaveBeenCalledWith({
      data: {
        productId: 'product-1',
        userId: 'user-1',
        quantityDelta: 40,
        reason: StockMovementReason.INITIAL_STOCK,
      },
    });
  });

  it('does not duplicate an existing initial stock movement', async () => {
    const movementCreate = vi.fn();
    await seedProducts(
      {
        product: { upsert: vi.fn().mockResolvedValue({ id: 'product-1' }) },
        stockMovement: {
          findFirst: vi.fn().mockResolvedValue({ id: 'movement-1' }),
          create: movementCreate,
        },
      },
      [
        {
          userId: 'user-1',
          sku: 'SF-100',
          name: 'Packing tape',
          description: 'Clear packing tape roll',
          unitPriceCents: 350,
          quantityOnHand: 40,
        },
      ],
    );

    expect(movementCreate).not.toHaveBeenCalled();
  });
});