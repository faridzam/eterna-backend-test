import { StockMovementReason } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { seedProducts } from './seed-products.js';

describe('seedProducts', () => {
  it('upserts each product and its idempotent initial stock movement', async () => {
    const productUpsert = vi.fn().mockResolvedValue({ id: 'product-1' });
    const movementUpsert = vi.fn().mockResolvedValue({ id: 'movement-1' });
    await seedProducts(
      {
        product: { upsert: productUpsert },
        stockMovement: { upsert: movementUpsert },
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
    expect(movementUpsert).toHaveBeenCalledWith({
      where: {
        productId_reason: {
          productId: 'product-1',
          reason: StockMovementReason.INITIAL_STOCK,
        },
      },
      update: {},
      create: {
        productId: 'product-1',
        userId: 'user-1',
        quantityDelta: 40,
        reason: StockMovementReason.INITIAL_STOCK,
      },
    });
  });
});