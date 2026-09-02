import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CsrfOriginGuard } from '../auth/csrf-origin.guard.js';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CreateInvoiceDto, InvoiceStatusDto, ListInvoicesQueryDto } from './dto/invoice.dto.js';
import { InvoicesService } from './invoices.service.js';

function authenticatedUserId(request: AuthenticatedRequest): string {
  if (request.authenticatedUser === undefined) {
    throw new Error('Authenticated request is missing a user.');
  }
  return request.authenticatedUser.id;
}

@Controller('invoices')
@UseGuards(SessionAuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @UseGuards(CsrfOriginGuard)
  async create(@Req() request: AuthenticatedRequest, @Body() input: CreateInvoiceDto) {
    return { data: await this.invoices.create(authenticatedUserId(request), input) };
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query() query: ListInvoicesQueryDto) {
    return { data: await this.invoices.list(authenticatedUserId(request), query) };
  }

  @Get(':id')
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return { data: await this.invoices.get(authenticatedUserId(request), id) };
  }

  @Patch(':id/status')
  @UseGuards(CsrfOriginGuard)
  async changeStatus(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: InvoiceStatusDto) {
    return { data: await this.invoices.changeStatus(authenticatedUserId(request), id, input.status) };
  }
}