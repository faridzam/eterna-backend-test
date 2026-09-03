import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AppConfigService } from '../config/app-config.service.js';
import { DuplicateEmailError } from './domain/auth.errors.js';
import type {
  SessionRepository,
  UserRepository,
} from './domain/auth.repository.js';
import {
  SESSION_REPOSITORY,
  USER_REPOSITORY,
} from './domain/auth.repository.js';
import type {
  AuthenticatedUser,
  SessionMetadata,
} from './domain/auth.types.js';
import { toAuthenticatedUser } from './domain/auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SessionTokenService } from './session-token.service.js';

export interface LoginResult {
  readonly expiresAt: Date;
  readonly rawToken: string;
  readonly user: AuthenticatedUser;
}

export interface RegisterResult {
  readonly message: string;
  readonly data: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    private readonly tokenService: SessionTokenService,
    private readonly config: AppConfigService,
  ) {}

  async register(input: RegisterDto): Promise<RegisterResult> {
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    try {
      const user = await this.users.create({
        name: input.name.trim(),
        email: this.normalizeEmail(input.email),
        passwordHash,
      });
      return {
        message: 'Account created successfully. Please sign in.',
        data: toAuthenticatedUser(user),
      };
    } catch (error: unknown) {
      if (error instanceof DuplicateEmailError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  async login(
    input: LoginDto,
    metadata: SessionMetadata,
  ): Promise<LoginResult> {
    const user = await this.users.findByEmail(this.normalizeEmail(input.email));
    const passwordMatches =
      user === null
        ? false
        : await argon2.verify(user.passwordHash, input.password);
    if (!passwordMatches || user === null) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const rawToken = this.tokenService.createRawToken();
    const expiresAt = new Date(Date.now() + this.config.sessionDurationMs);
    await this.sessions.create({
      userId: user.id,
      tokenHash: this.tokenService.hash(rawToken),
      expiresAt,
      ...metadata,
    });
    return { rawToken, expiresAt, user: toAuthenticatedUser(user) };
  }

  async getAuthenticatedUser(
    rawToken: string,
  ): Promise<AuthenticatedUser | null> {
    const session = await this.sessions.findByTokenHash(
      this.tokenService.hash(rawToken),
    );
    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      return null;
    }
    const user = await this.users.findById(session.userId);
    return user === null ? null : toAuthenticatedUser(user);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken !== undefined) {
      await this.sessions.revokeByTokenHash(
        this.tokenService.hash(rawToken),
        new Date(),
      );
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
