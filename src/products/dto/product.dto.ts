import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
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

export class CreateProductDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  declare sku: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  declare name: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  declare unitPriceCents: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  declare quantityOnHand: number;
}

export class UpdateProductDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  unitPriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  quantityOnHand?: number;
}

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
