export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export function paginationOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}