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
  readonly deletedAt: Date | null;
  readonly owner?: ProductOwner;
}

export interface ProductOwner {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface ProductScope {
  readonly userId: string;
  readonly role: 'ADMIN' | 'STAFF';
}

export interface ProductPage {
  readonly items: readonly ProductRecord[];
  readonly total: number;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
export type CreateProductRecord = Omit<
  ProductRecord,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;
export type UpdateProductRecord = Partial<
  Pick<
    ProductRecord,
    'sku' | 'name' | 'description' | 'unitPriceCents' | 'quantityOnHand'
  >
>;

export interface ProductRepository {
  create(input: CreateProductRecord): Promise<ProductRecord>;
  findById(userId: string, id: string): Promise<ProductRecord | null>;
  findMany(
    scope: ProductScope,
    search: string | undefined,
    skip: number,
    take: number,
  ): Promise<ProductPage>;
  update(
    userId: string,
    id: string,
    input: UpdateProductRecord,
  ): Promise<ProductRecord | null>;
  delete(scope: ProductScope, id: string): Promise<boolean>;
}
