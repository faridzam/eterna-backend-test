import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CsrfOriginGuard } from '../auth/csrf-origin.guard.js';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CreateProductDto, ListProductsQueryDto, UpdateProductDto } from './dto/product.dto.js';
import { ProductsService } from './products.service.js';

function authenticatedUserId(request: AuthenticatedRequest): string {
  if (request.authenticatedUser === undefined) {
    throw new Error('Authenticated request is missing a user.');
  }
  return request.authenticatedUser.id;
}

@Controller('products')
@UseGuards(SessionAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @UseGuards(CsrfOriginGuard)
  async create(@Req() request: AuthenticatedRequest, @Body() input: CreateProductDto) {
    return { data: await this.products.create(authenticatedUserId(request), input) };
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query() query: ListProductsQueryDto) {
    return { data: await this.products.list(authenticatedUserId(request), query) };
  }

  @Get(':id')
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return { data: await this.products.get(authenticatedUserId(request), id) };
  }

  @Patch(':id')
  @UseGuards(CsrfOriginGuard)
  async update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: UpdateProductDto) {
    return { data: await this.products.update(authenticatedUserId(request), id, input) };
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(CsrfOriginGuard)
  async delete(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.products.delete(authenticatedUserId(request), id);
  }
}