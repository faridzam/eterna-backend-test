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
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiExtraModels,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
    getSchemaPath,
} from '@nestjs/swagger';
import { CsrfOriginGuard } from '../auth/csrf-origin.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import {
    CreateProductDto,
    ListProductsQueryDto,
    ProductOwnerResponseDto,
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
@ApiExtraModels(ProductOwnerResponseDto)
@UseGuards(SessionAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an active product' })
  @ApiCreatedResponse({ description: 'Product created successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid product fields.' })
  @ApiConflictResponse({
    description: 'An active product already uses the SKU.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
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
  @ApiOkResponse({
    description:
      'Products retrieved successfully. Admin items include a sanitized owner with id, name, and email.',
    schema: {
      properties: {
        data: {
          properties: {
            items: {
              items: {
                properties: {
                  owner: { $ref: getSchemaPath(ProductOwnerResponseDto) },
                },
                type: 'object',
              },
              type: 'array',
            },
          },
          type: 'object',
        },
      },
      type: 'object',
    },
  })
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
  @ApiOkResponse({ description: 'Product retrieved successfully.' })
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
  @ApiOkResponse({ description: 'Product updated successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid product fields.' })
  @ApiConflictResponse({
    description: 'An active product already uses the SKU.',
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
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
  @ApiOkResponse({ description: 'Product deleted successfully.' })
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
