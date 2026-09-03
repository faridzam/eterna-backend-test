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
    findFirst(input: {
      readonly where: {
        readonly productId: string;
        readonly reason: StockMovementReason;
      };
    }): Promise<{ readonly id: string } | null>;
    create(input: {
      readonly data: {
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
    const initialStock = await transaction.stockMovement.findFirst({
      where: {
        productId: product.id,
        reason: StockMovementReason.INITIAL_STOCK,
      },
    });
    if (initialStock === null) {
      await transaction.stockMovement.create({
        data: {
          productId: product.id,
          userId: input.userId,
          quantityDelta: input.quantityOnHand,
          reason: StockMovementReason.INITIAL_STOCK,
        },
      });
    }
  }
}