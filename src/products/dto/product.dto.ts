import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsDefined,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateIf,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ProductOwnerResponseDto {
  @ApiProperty({ description: 'Owner identifier' })
  declare id: string;

  @ApiProperty({ description: 'Owner display name' })
  declare name: string;

  @ApiProperty({ description: 'Owner email address' })
  declare email: string;
}

export class ProductResponseDto {
  @ApiProperty({ example: 'product-1' })
  declare id: string;
  @ApiProperty({ example: 'user-1' })
  declare userId: string;
  @ApiProperty({ example: 'SF-100' })
  declare sku: string;
  @ApiProperty({ example: 'Packing tape' })
  declare name: string;
  @ApiProperty({ nullable: true, example: 'Clear packing tape' })
  declare description: string | null;
  @ApiProperty({ example: 350, minimum: 0 })
  declare unitPriceCents: number;
  @ApiProperty({ example: 25, minimum: 0 })
  declare quantityOnHand: number;
  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  declare createdAt: string;
  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  declare updatedAt: string;
  @ApiPropertyOptional({ type: ProductOwnerResponseDto })
  declare owner?: ProductOwnerResponseDto;
}

export class ProductEnvelopeDto {
  @ApiProperty({ example: 'Product retrieved successfully.' })
  declare message: string;
  @ApiProperty({ type: ProductResponseDto })
  declare data: ProductResponseDto;
}

export class ProductPageDto {
  @ApiProperty({ type: ProductResponseDto, isArray: true })
  declare items: ProductResponseDto[];
  @ApiProperty({ example: 1 })
  declare total: number;
  @ApiProperty({ example: 1 })
  declare page: number;
  @ApiProperty({ example: 20, maximum: 100 })
  declare pageSize: number;
}

export class ProductPageEnvelopeDto {
  @ApiProperty({ example: 'Products retrieved successfully.' })
  declare message: string;
  @ApiProperty({ type: ProductPageDto })
  declare data: ProductPageDto;
}

export class ProductMessageEnvelopeDto {
  @ApiProperty({ example: 'Product deleted successfully.' })
  declare message: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: false,
    nullable: true,
    example: null,
  })
  declare data: null;
}

export class CreateProductDto {
  @ApiProperty({ example: 'SF-100', maxLength: 100 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  declare sku: string;

  @ApiProperty({ example: 'Packing tape', maxLength: 200 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  declare name: string;

  @ApiPropertyOptional({ example: 'Clear packing tape', maxLength: 2000 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 350, minimum: 0, maximum: 100000000 })
  @IsDefined()
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? value
      : typeof value === 'string'
        ? value.trim() === ''
          ? value
          : Number(value)
        : value,
  )
  @IsInt()
  @Min(0)
  @Max(100000000)
  declare unitPriceCents: number;

  @ApiProperty({ example: 25, minimum: 0, maximum: 100000000 })
  @IsDefined()
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? value
      : typeof value === 'string'
        ? value.trim() === ''
          ? value
          : Number(value)
        : value,
  )
  @IsInt()
  @Min(0)
  @Max(100000000)
  declare quantityOnHand: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'SF-100', maxLength: 100 })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({ example: 'Packing tape', maxLength: 200 })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Clear packing tape', maxLength: 2000 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 350, minimum: 0, maximum: 100000000 })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? value
      : typeof value === 'string'
        ? value.trim() === ''
          ? value
          : Number(value)
        : value,
  )
  @IsInt()
  @Min(0)
  @Max(100000000)
  unitPriceCents?: number;

  @ApiPropertyOptional({ example: 25, minimum: 0, maximum: 100000000 })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? value
      : typeof value === 'string'
        ? value.trim() === ''
          ? value
          : Number(value)
        : value,
  )
  @IsInt()
  @Min(0)
  @Max(100000000)
  quantityOnHand?: number;
}

export class ListProductsQueryDto {
  @ApiPropertyOptional({ example: 'tape', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
