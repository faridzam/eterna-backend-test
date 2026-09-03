import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter.js';
import { AppConfigService } from '../config/app-config.service.js';
import { ProductsController } from '../products/products.controller.js';
import { ProductsService } from '../products/products.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CsrfOriginGuard } from './csrf-origin.guard.js';
import { SessionAuthGuard } from './session-auth.guard.js';

const user = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('cookie-backed authentication', () => {
  let app: INestApplication<App> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createApp() {
    const auth = {
      login: vi.fn().mockResolvedValue({
        rawToken: 'raw-session-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        user,
      }),
      getAuthenticatedUser: vi
        .fn()
        .mockImplementation(async (token: string) =>
          token === 'raw-session-token' ? user : null,
        ),
    };
    const products = {
      list: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 }),
    };
    const module = await Test.createTestingModule({
      controllers: [AuthController, ProductsController],
      providers: [
        AppConfigService,
        SessionAuthGuard,
        CsrfOriginGuard,
        { provide: AuthService, useValue: auth },
        { provide: ProductsService, useValue: products },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    const application = app;
    return { application, auth, products };
  }

  it('uses the login cookie for products and the current-user endpoint', async () => {
    const harness = await createApp();
    const agent = request.agent(harness.application.getHttpServer());
    const login = await agent
      .post('/auth/login')
      .send({ email: user.email, password: 'correct-password' })
      .expect(200);
    expect(login.headers['set-cookie']?.join(';')).toContain(
      'stockflow_session=raw-session-token',
    );

    await agent
      .get('/products?page=1&pageSize=10')
      .expect(200)
      .expect({
        message: 'Products retrieved successfully.',
        data: { items: [], total: 0, page: 1, pageSize: 10 },
      });
    await agent
      .get('/auth/me')
      .expect(200)
      .expect({
        message: 'Authenticated user retrieved successfully.',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
        },
      });
    expect(harness.auth.getAuthenticatedUser).toHaveBeenCalledWith(
      'raw-session-token',
    );
    expect(harness.products.list).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ page: '1', pageSize: '10' }),
    );
  });

  it('rejects protected requests without a session cookie using the error envelope', async () => {
    await createApp();
    const application = app;
    if (application === undefined)
      throw new Error('Test application was not created.');
    await request(application.getHttpServer())
      .get('/products')
      .expect(401)
      .expect({
        status: 401,
        message: 'Authentication is required.',
        data: null,
      });
    await request(application.getHttpServer())
      .get('/auth/me')
      .expect(401)
      .expect({
        status: 401,
        message: 'Authentication is required.',
        data: null,
      });
  });
});
