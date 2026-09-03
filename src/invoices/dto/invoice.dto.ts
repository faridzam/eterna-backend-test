import { InvoiceStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';

export const INVOICE_MUTATION_KEY_MAX_LENGTH = 200;

export class InvoiceLineDto {
  @IsString()
  declare productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000000)
  declare quantity: number;
}

export class CreateInvoiceDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  declare customerName: string;

  @IsDateString()
  declare issueDate: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  declare items: InvoiceLineDto[];
}

export class UpdateInvoiceDto extends CreateInvoiceDto {}

export class ListInvoicesQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

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

export class InvoiceStatusDto {
  @IsEnum(InvoiceStatus)
  declare status: InvoiceStatus;
}
