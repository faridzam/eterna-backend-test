import {
    Body,
    Controller,
    Delete,
    Get,
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
    ApiExtraModels,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CsrfOriginGuard } from '../auth/csrf-origin.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import {
    CreateProductDto,
    ListProductsQueryDto,
    ProductEnvelopeDto,
    ProductMessageEnvelopeDto,
    ProductOwnerResponseDto,
    ProductPageEnvelopeDto,
    UpdateProductDto,
} from './dto/product.dto.js';
import { ProductsService } from './products.service.js';

function authenticatedUserId(request: AuthenticatedRequest): string {
  if (request.authenticatedUser === undefined) {
    throw new Error('Authenticated request is missing a user.');
  }
  return request.authenticatedUser.id;
}

function authenticatedUser(request: AuthenticatedRequest) {
  if (request.authenticatedUser === undefined) {
    throw new Error('Authenticated request is missing a user.');
  }
  return request.authenticatedUser;
}

@Controller('products')
@ApiTags('products')
@ApiCookieAuth('stockflow_session')
@ApiExtraModels(ProductOwnerResponseDto)
@UseGuards(SessionAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an active product' })
  @ApiBody({ type: CreateProductDto })
  @ApiCreatedResponse({ description: 'Product created successfully.', type: ProductEnvelopeDto })
  @ApiBadRequestResponse({ description: 'Invalid product fields.' })
  @ApiConflictResponse({
    description: 'An active product already uses the SKU.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({ description: 'Request origin is not trusted.' })
  @UseGuards(CsrfOriginGuard)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateProductDto,
  ) {
    return {
      message: 'Product created successfully.',
      data: await this.products.create(authenticatedUserId(request), input),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List active products' })
  @ApiQuery({ name: 'search', required: false, example: 'tape' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiOkResponse({ description: 'Products retrieved successfully.', type: ProductPageEnvelopeDto })
  @ApiNotFoundResponse({ description: 'No products match the filter.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListProductsQueryDto,
  ) {
    return {
      message: 'Products retrieved successfully.',
      data: await this.products.list(authenticatedUser(request), query),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read an active product' })
  @ApiParam({ name: 'id', example: 'product-1' })
  @ApiOkResponse({ description: 'Product retrieved successfully.', type: ProductEnvelopeDto })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return {
      message: 'Product retrieved successfully.',
      data: await this.products.get(authenticatedUserId(request), id),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an active product' })
  @ApiParam({ name: 'id', example: 'product-1' })
  @ApiBody({ type: UpdateProductDto })
  @ApiOkResponse({ description: 'Product updated successfully.', type: ProductEnvelopeDto })
  @ApiBadRequestResponse({ description: 'Invalid product fields.' })
  @ApiConflictResponse({
    description: 'An active product already uses the SKU.',
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({ description: 'Request origin is not trusted.' })
  @UseGuards(CsrfOriginGuard)
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
  ) {
    return {
      message: 'Product updated successfully.',
      data: await this.products.update(authenticatedUserId(request), id, input),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete an active product' })
  @ApiParam({ name: 'id', example: 'product-1' })
  @ApiOkResponse({ description: 'Product deleted successfully.', type: ProductMessageEnvelopeDto })
  @ApiNotFoundResponse({
    description: 'Product not found, including already deleted products.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description: 'You are not allowed to perform this action.',
  })
  @UseGuards(CsrfOriginGuard)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async delete(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.products.delete(authenticatedUser(request), id);
    return { message: 'Product deleted successfully.', data: null };
  }
}
