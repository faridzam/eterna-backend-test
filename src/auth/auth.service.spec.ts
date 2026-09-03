import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import * as argon2 from 'argon2';
import { describe, expect, it } from 'vitest';
import { AppConfigService } from '../config/app-config.service.js';
import { AuthService } from './auth.service.js';
import { DuplicateEmailError } from './domain/auth.errors.js';
import { SessionRepository, UserRepository } from './domain/auth.repository.js';
import {
  SessionMetadata,
  SessionRecord,
  UserRecord,
} from './domain/auth.types.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { SESSION_COOKIE_NAME } from './session-cookie.js';
import { SessionTokenService } from './session-token.service.js';

function createHarness() {
  let storedUser: UserRecord | null = null;
  const sessions: SessionRecord[] = [];
  const users: UserRepository = {
    async create(input) {
      storedUser = {
        id: 'user-1',
        ...input,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      return storedUser;
    },
    async findByEmail(email) {
      return storedUser?.email === email ? storedUser : null;
    },
    async findById(id) {
      return storedUser?.id === id ? storedUser : null;
    },
  };
  const sessionRepository: SessionRepository = {
    async create(
      input: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
      } & SessionMetadata,
    ) {
      const session: SessionRecord = {
        id: `session-${sessions.length + 1}`,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdAt: new Date(),
        revokedAt: null,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
      };
      sessions.push(session);
      return session;
    },
    async findByTokenHash(tokenHash) {
      return (
        sessions.find((session) => session.tokenHash === tokenHash) ?? null
      );
    },
    async revokeByTokenHash(tokenHash, revokedAt) {
      const session = sessions.find(
        (candidate) =>
          candidate.tokenHash === tokenHash && candidate.revokedAt === null,
      );
      if (session !== undefined) {
        session.revokedAt = revokedAt;
      }
    },
  };
  const config = new AppConfigService();
  const tokens = new SessionTokenService(config);
  return {
    service: new AuthService(users, sessionRepository, tokens, config),
    sessions,
    tokens,
    users,
  };
}

describe('AuthService', () => {
  it('registers an Argon2id password hash without returning it', async () => {
    const harness = createHarness();
    const result = await harness.service.register({
      name: 'Ada Lovelace',
      email: ' ADA@EXAMPLE.COM ',
      password: 'correct-password',
    });
    const storedUser = await harness.users.findByEmail('ada@example.com');

    expect(result).toEqual(
      expect.objectContaining({
        message: 'Account created successfully. Please sign in.',
        data: expect.objectContaining({
          email: 'ada@example.com',
          name: 'Ada Lovelace',
        }),
      }),
    );
    expect(result).not.toHaveProperty('passwordHash');
    expect(storedUser?.passwordHash).toContain('$argon2id$');
    expect(
      await argon2.verify(storedUser?.passwordHash ?? '', 'correct-password'),
    ).toBe(true);
  });

  it('maps duplicate email failures to a conflict with a safe message', async () => {
    const harness = createHarness();
    harness.users.create = async () => {
      throw new DuplicateEmailError();
    };

    await expect(
      harness.service.register({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'correct-password',
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'An account already exists for that email address.',
    });
  });

  it('rejects invalid credentials without creating a session', async () => {
    const harness = createHarness();
    await harness.service.register({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'correct-password',
    });

    await expect(
      harness.service.login(
        { email: 'ada@example.com', password: 'incorrect-password' },
        {},
      ),
    ).rejects.toThrow('Invalid email or password.');
    expect(harness.sessions).toHaveLength(0);
  });

  it('stores only the deterministic hash of a new raw session token', async () => {
    const harness = createHarness();
    await harness.service.register({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'correct-password',
    });
    const login = await harness.service.login(
      { email: 'ADA@example.com', password: 'correct-password' },
      { ipAddress: '127.0.0.1' },
    );

    expect(harness.sessions).toHaveLength(1);
    expect(harness.sessions[0]?.tokenHash).toBe(
      harness.tokens.hash(login.rawToken),
    );
    expect(harness.sessions[0]?.tokenHash).not.toBe(login.rawToken);
    expect(Object.keys(harness.sessions[0] ?? {})).not.toContain('rawToken');
  });

  it('allows a valid session and rejects revoked and expired sessions', async () => {
    const harness = createHarness();
    await harness.service.register({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'correct-password',
    });
    const login = await harness.service.login(
      { email: 'ada@example.com', password: 'correct-password' },
      {},
    );
    const guard = new SessionAuthGuard(harness.service);
    const request = { cookies: { [SESSION_COOKIE_NAME]: login.rawToken } };

    await expect(
      guard.canActivate(new ExecutionContextHost([request])),
    ).resolves.toBe(true);
    expect(request).toHaveProperty('authenticatedUser.id', 'user-1');
    await harness.service.logout(login.rawToken);
    await expect(
      guard.canActivate(new ExecutionContextHost([request])),
    ).rejects.toThrow('Authentication is required.');

    harness.sessions.push({
      id: 'expired',
      userId: 'user-1',
      tokenHash: harness.tokens.hash('expired-token'),
      expiresAt: new Date(0),
      createdAt: new Date(0),
      revokedAt: null,
      userAgent: null,
      ipAddress: null,
    });
    await expect(
      guard.canActivate(
        new ExecutionContextHost([
          { cookies: { [SESSION_COOKIE_NAME]: 'expired-token' } },
        ]),
      ),
    ).rejects.toThrow('Authentication is required.');
    await expect(
      guard.canActivate(
        new ExecutionContextHost([
          { cookies: { [SESSION_COOKIE_NAME]: { malformed: true } } },
        ]),
      ),
    ).rejects.toThrow('Authentication is required.');
    await expect(
      guard.canActivate(new ExecutionContextHost([{ cookies: {} }])),
    ).rejects.toThrow('Authentication is required.');
  });

  it('makes logout idempotent when a session is already revoked or missing', async () => {
    const harness = createHarness();
    await harness.service.register({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'correct-password',
    });
    const login = await harness.service.login(
      { email: 'ada@example.com', password: 'correct-password' },
      {},
    );

    await expect(
      harness.service.logout(login.rawToken),
    ).resolves.toBeUndefined();
    await expect(
      harness.service.logout(login.rawToken),
    ).resolves.toBeUndefined();
    await expect(harness.service.logout(undefined)).resolves.toBeUndefined();
  });
});
