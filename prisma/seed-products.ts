import { StockMovementReason } from '@prisma/client';

export interface SeedProductInput {
  readonly userId: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly unitPriceCents: number;
  readonly quantityOnHand: number;
}

interface SeedTransaction {
  readonly product: {
    upsert(input: {
      readonly where: { readonly userId_sku: { readonly userId: string; readonly sku: string } };
      readonly update: Record<string, never>;
      readonly create: SeedProductInput;
    }): Promise<{ readonly id: string }>;
  };
  readonly stockMovement: {
    upsert(input: {
      readonly where: {
        readonly productId_reason: {
          readonly productId: string;
          readonly reason: StockMovementReason;
        };
      };
      readonly update: Record<string, never>;
      readonly create: {
        readonly productId: string;
        readonly userId: string;
        readonly quantityDelta: number;
        readonly reason: StockMovementReason;
      };
    }): Promise<unknown>;
  };
}

export async function seedProducts(
  transaction: SeedTransaction,
  products: readonly SeedProductInput[],
): Promise<void> {
  for (const input of products) {
    const product = await transaction.product.upsert({
      where: { userId_sku: { userId: input.userId, sku: input.sku } },
      update: {},
      create: input,
    });
    await transaction.stockMovement.upsert({
      where: {
        productId_reason: {
          productId: product.id,
          reason: StockMovementReason.INITIAL_STOCK,
        },
      },
      update: {},
      create: {
        productId: product.id,
        userId: input.userId,
        quantityDelta: input.quantityOnHand,
        reason: StockMovementReason.INITIAL_STOCK,
      },
    });
  }
}