import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../config/app-config.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let app: INestApplication<App> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('sets an HttpOnly opaque cookie on login without exposing the token in JSON', async () => {
    const login = vi.fn().mockResolvedValue({
      rawToken: 'raw-session-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      user: { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com', createdAt: new Date('2026-01-01T00:00:00.000Z') },
    });
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AppConfigService,
        { provide: AuthService, useValue: { login } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer()).post('/auth/login').send({ email: 'ada@example.com', password: 'correct-password' }).expect(200);
    expect(response.headers['set-cookie']?.join(';')).toContain('stockflow_session=raw-session-token');
    expect(response.headers['set-cookie']?.join(';')).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.join(';')).toContain('SameSite=Lax');
    expect(response.body).toEqual({ data: { user: expect.not.objectContaining({ rawToken: expect.any(String), passwordHash: expect.any(String) }) } });
  });

  it('returns the backend registration message and safe user data', async () => {
    const register = vi.fn().mockResolvedValue({
      message: 'Account created successfully. Please sign in.',
      data: { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com', createdAt: new Date('2026-01-01T00:00:00.000Z') },
    });
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AppConfigService, { provide: AuthService, useValue: { register } }],
    }).compile();
    app = module.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer()).post('/auth/register').send({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'correct-password' }).expect(201);
    expect(response.body).toEqual({
      message: 'Account created successfully. Please sign in.',
      data: { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(response.body.data).not.toHaveProperty('password');
  });
});