import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CsrfOriginGuard } from '../auth/csrf-origin.guard.js';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CreateInvoiceDto, InvoiceStatusDto, ListInvoicesQueryDto, UpdateInvoiceDto } from './dto/invoice.dto.js';
import { InvoicesService } from './invoices.service.js';

function authenticatedUserId(request: AuthenticatedRequest): string {
  if (request.authenticatedUser === undefined) {
    throw new Error('Authenticated request is missing a user.');
  }
  return request.authenticatedUser.id;
}

@Controller('invoices')
@ApiTags('invoices')
@UseGuards(SessionAuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a draft invoice' })
  @ApiCreatedResponse({ description: 'Invoice created successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid invoice fields or insufficient stock.' })
  @ApiNotFoundResponse({ description: 'Referenced product was not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @UseGuards(CsrfOriginGuard)
  async create(@Req() request: AuthenticatedRequest, @Body() input: CreateInvoiceDto) {
    return { message: 'Invoice created successfully.', data: await this.invoices.create(authenticatedUserId(request), input) };
  }

  @Get()
  @ApiOperation({ summary: 'List owned invoices' })
  @ApiOkResponse({ description: 'Invoices retrieved successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  async list(@Req() request: AuthenticatedRequest, @Query() query: ListInvoicesQueryDto) {
    return { message: 'Invoices retrieved successfully.', data: await this.invoices.list(authenticatedUserId(request), query) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read an owned invoice' })
  @ApiOkResponse({ description: 'Invoice retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Invoice not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return { message: 'Invoice retrieved successfully.', data: await this.invoices.get(authenticatedUserId(request), id) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a draft invoice' })
  @ApiOkResponse({ description: 'Invoice updated successfully.' })
  @ApiConflictResponse({ description: 'Only draft invoices can be edited.' })
  @ApiNotFoundResponse({ description: 'Invoice or referenced product was not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @UseGuards(CsrfOriginGuard)
  async update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: UpdateInvoiceDto) {
    return { message: 'Invoice updated successfully.', data: await this.invoices.updateDraft(authenticatedUserId(request), id, input) };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change invoice status' })
  @ApiOkResponse({ description: 'Invoice status updated successfully.' })
  @ApiBadRequestResponse({ description: 'Insufficient stock to issue the invoice.' })
  @ApiConflictResponse({ description: 'The status transition is not allowed or conflicted.' })
  @ApiNotFoundResponse({ description: 'Invoice not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @UseGuards(CsrfOriginGuard)
  async changeStatus(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: InvoiceStatusDto) {
    return { message: 'Invoice status updated successfully.', data: await this.invoices.changeStatus(authenticatedUserId(request), id, input.status) };
  }
}