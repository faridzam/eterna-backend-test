export interface ProductRecord {
  readonly id: string;
  readonly userId: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string | null;
  readonly unitPriceCents: number;
  readonly quantityOnHand: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductPage {
  readonly items: readonly ProductRecord[];
  readonly total: number;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductRepository {
  create(input: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductRecord>;
  findById(userId: string, id: string): Promise<ProductRecord | null>;
  findMany(userId: string, search: string | undefined, skip: number, take: number): Promise<ProductPage>;
  update(userId: string, id: string, input: Partial<Pick<ProductRecord, 'sku' | 'name' | 'description' | 'unitPriceCents' | 'quantityOnHand'>>): Promise<ProductRecord | null>;
  delete(userId: string, id: string): Promise<boolean>;
}