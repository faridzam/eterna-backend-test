import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBody,
    ApiConflictResponse,
    ApiCookieAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { CsrfOriginGuard } from '../auth/csrf-origin.guard.js';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import {
    CreateInvoiceDto,
    InvoiceEnvelopeDto,
    InvoicePageEnvelopeDto,
    InvoiceStatusDto,
    ListInvoicesQueryDto,
    UpdateInvoiceDto,
} from './dto/invoice.dto.js';
import { InvoicesService } from './invoices.service.js';

function authenticatedUserId(request: AuthenticatedRequest): string {
  if (request.authenticatedUser === undefined) {
    throw new Error('Authenticated request is missing a user.');
  }
  return request.authenticatedUser.id;
}

function requiredHeader(
  value: string | string[] | undefined,
  name: string,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > 200
  ) {
    throw new BadRequestException(`${name} header is required.`);
  }
  return value.trim();
}

function expectedVersion(value: string | string[] | undefined): number {
  const header = requiredHeader(value, 'If-Match');
  const version = Number(header);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new BadRequestException('If-Match must be a positive integer version.');
  }
  return version;
}

@Controller('invoices')
@ApiTags('invoices')
@ApiCookieAuth('stockflow_session')
@UseGuards(SessionAuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a draft invoice' })
  @ApiBody({ type: CreateInvoiceDto })
  @ApiCreatedResponse({ description: 'Invoice created successfully.', type: InvoiceEnvelopeDto })
  @ApiBadRequestResponse({
    description: 'Invalid invoice fields or insufficient stock.',
  })
  @ApiNotFoundResponse({ description: 'Referenced product was not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({ description: 'Request origin is not trusted.' })
  @UseGuards(CsrfOriginGuard)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateInvoiceDto,
  ) {
    return {
      message: 'Invoice created successfully.',
      data: await this.invoices.create(authenticatedUserId(request), input),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List owned invoices' })
  @ApiQuery({ name: 'status', required: false, enum: Object.values(InvoiceStatus) })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiOkResponse({ description: 'Invoices retrieved successfully.', type: InvoicePageEnvelopeDto })
  @ApiNotFoundResponse({ description: 'No invoices match the filter.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListInvoicesQueryDto,
  ) {
    return {
      message: 'Invoices retrieved successfully.',
      data: await this.invoices.list(authenticatedUserId(request), query),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read an owned invoice' })
  @ApiParam({ name: 'id', example: 'invoice-1' })
  @ApiOkResponse({ description: 'Invoice retrieved successfully.', type: InvoiceEnvelopeDto })
  @ApiNotFoundResponse({ description: 'Invoice not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return {
      message: 'Invoice retrieved successfully.',
      data: await this.invoices.get(authenticatedUserId(request), id),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a draft invoice' })
  @ApiParam({ name: 'id', example: 'invoice-1' })
  @ApiHeader({ name: 'If-Match', description: 'Expected invoice version.', example: '1' })
  @ApiHeader({ name: 'Idempotency-Key', description: 'Unique key for retry-safe mutation.', example: 'invoice-update-1' })
  @ApiBody({ type: UpdateInvoiceDto })
  @ApiOkResponse({ description: 'Invoice updated successfully.', type: InvoiceEnvelopeDto })
  @ApiConflictResponse({ description: 'Only draft invoices can be edited.' })
  @ApiNotFoundResponse({
    description: 'Invoice or referenced product was not found.',
  })
  @ApiBadRequestResponse({ description: 'Invalid invoice fields or required headers.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({ description: 'Request origin is not trusted.' })
  @UseGuards(CsrfOriginGuard)
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: UpdateInvoiceDto,
    @Headers('if-match') ifMatch: string | string[] | undefined,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined,
  ) {
    return {
      message: 'Invoice updated successfully.',
      data: await this.invoices.updateDraft(
        authenticatedUserId(request),
        id,
        expectedVersion(ifMatch),
        requiredHeader(idempotencyKey, 'Idempotency-Key'),
        JSON.stringify(input),
        input,
      ),
    };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change invoice status' })
  @ApiParam({ name: 'id', example: 'invoice-1' })
  @ApiHeader({ name: 'If-Match', description: 'Expected invoice version.', example: '1' })
  @ApiHeader({ name: 'Idempotency-Key', description: 'Unique key for retry-safe mutation.', example: 'invoice-status-1' })
  @ApiBody({ type: InvoiceStatusDto })
  @ApiOkResponse({ description: 'Invoice status updated successfully.', type: InvoiceEnvelopeDto })
  @ApiBadRequestResponse({
    description:
      'Invalid status or required headers, or insufficient stock to issue the invoice.',
  })
  @ApiConflictResponse({
    description: 'The status transition is not allowed or conflicted.',
  })
  @ApiNotFoundResponse({ description: 'Invoice not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({ description: 'Request origin is not trusted.' })
  @UseGuards(CsrfOriginGuard)
  async changeStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: InvoiceStatusDto,
    @Headers('if-match') ifMatch: string | string[] | undefined,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined,
  ) {
    return {
      message: 'Invoice status updated successfully.',
      data: await this.invoices.changeStatus(
        authenticatedUserId(request),
        id,
        input.status,
        expectedVersion(ifMatch),
        requiredHeader(idempotencyKey, 'Idempotency-Key'),
        JSON.stringify(input),
      ),
    };
  }
}
