import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, it, vi } from 'vitest';
import {
  AuthenticatedRequest,
  SessionAuthGuard,
} from '../auth/session-auth.guard.js';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter.js';
import { AppConfigService } from '../config/app-config.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

describe('ProductsController', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
  });

  it('returns success and normalized error envelopes', async () => {
    const products = {
      list: vi
        .fn()
        .mockRejectedValue(new NotFoundException('No products found.')),
      get: vi
        .fn()
        .mockRejectedValue(new NotFoundException('Product not found.')),
    };
    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [AppConfigService, ProductsService],
    })
      .overrideProvider(ProductsService)
      .useValue(products)
      .overrideGuard(SessionAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>().authenticatedUser = {
            id: 'user-1',
            name: 'Ada',
            email: 'ada@example.com',
            role: 'STAFF',
            createdAt: new Date(),
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await request(app.getHttpServer())
      .get('/products')
      .expect(404)
      .expect({ status: 404, message: 'No products found.', data: null });
    await request(app.getHttpServer())
      .get('/products/product-1')
      .expect(404)
      .expect({ status: 404, message: 'Product not found.', data: null });
  });
});
