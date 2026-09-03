import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: 'product-1' })
  @IsString()
  declare productId: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 100000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000000)
  declare quantity: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'Acme Corporation', maxLength: 200 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  declare customerName: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-03T00:00:00.000Z' })
  @IsDateString()
  declare issueDate: string;

  @ApiPropertyOptional({ format: 'date-time', example: '2026-09-30T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'Net 30', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ type: InvoiceLineDto, isArray: true, minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  declare items: InvoiceLineDto[];
}

export class UpdateInvoiceDto extends CreateInvoiceDto {}

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatus, example: InvoiceStatus.DRAFT })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

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

export class InvoiceStatusDto {
  @ApiProperty({ enum: InvoiceStatus, example: InvoiceStatus.ISSUED })
  @IsEnum(InvoiceStatus)
  declare status: InvoiceStatus;
}

export class InvoiceItemResponseDto {
  @ApiProperty({ example: 'item-1' }) declare id: string;
  @ApiProperty({ example: 'invoice-1' }) declare invoiceId: string;
  @ApiProperty({ example: 'product-1' }) declare productId: string;
  @ApiProperty({ example: 'Packing tape' }) declare productName: string;
  @ApiProperty({ example: 350 }) declare unitPriceCents: number;
  @ApiProperty({ example: 2 }) declare quantity: number;
  @ApiProperty({ example: 700 }) declare lineTotalCents: number;
}

export class InvoiceResponseDto {
  @ApiProperty({ example: 'invoice-1' }) declare id: string;
  @ApiProperty({ example: 'user-1' }) declare userId: string;
  @ApiProperty({ example: 'INV-2026-0001' }) declare invoiceNumber: string;
  @ApiProperty({ example: 'Acme Corporation' }) declare customerName: string;
  @ApiProperty({ format: 'date-time', example: '2026-09-03T00:00:00.000Z' }) declare issueDate: string;
  @ApiProperty({ nullable: true, format: 'date-time', example: null }) declare dueDate: string | null;
  @ApiProperty({ enum: InvoiceStatus, example: InvoiceStatus.DRAFT }) declare status: InvoiceStatus;
  @ApiProperty({ example: 1 }) declare version: number;
  @ApiProperty({ nullable: true, example: null }) declare notes: string | null;
  @ApiProperty({ example: 700 }) declare subtotalCents: number;
  @ApiProperty({ example: 77 }) declare taxAmountCents: number;
  @ApiProperty({ example: 777 }) declare totalCents: number;
  @ApiProperty({ format: 'date-time', example: '2026-09-03T00:00:00.000Z' }) declare createdAt: string;
  @ApiProperty({ format: 'date-time', example: '2026-09-03T00:00:00.000Z' }) declare updatedAt: string;
  @ApiProperty({ type: InvoiceItemResponseDto, isArray: true }) declare items: InvoiceItemResponseDto[];
}

export class InvoiceEnvelopeDto {
  @ApiProperty({ example: 'Invoice retrieved successfully.' }) declare message: string;
  @ApiProperty({ type: InvoiceResponseDto }) declare data: InvoiceResponseDto;
}

export class InvoicePageDto {
  @ApiProperty({ type: InvoiceResponseDto, isArray: true }) declare items: InvoiceResponseDto[];
  @ApiProperty({ example: 1 }) declare total: number;
  @ApiProperty({ example: 1 }) declare page: number;
  @ApiProperty({ example: 20, maximum: 100 }) declare pageSize: number;
}

export class InvoicePageEnvelopeDto {
  @ApiProperty({ example: 'Invoices retrieved successfully.' }) declare message: string;
  @ApiProperty({ type: InvoicePageDto }) declare data: InvoicePageDto;
}
