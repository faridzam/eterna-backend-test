import { InvoiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

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
  @IsString()
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