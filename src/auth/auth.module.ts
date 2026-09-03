import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CsrfOriginGuard } from './csrf-origin.guard.js';
import {
  SESSION_REPOSITORY,
  USER_REPOSITORY,
} from './domain/auth.repository.js';
import {
  PrismaSessionRepository,
  PrismaUserRepository,
} from './repositories/prisma-auth.repository.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { SessionTokenService } from './session-token.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionTokenService,
    SessionAuthGuard,
    CsrfOriginGuard,
    PrismaUserRepository,
    PrismaSessionRepository,
    { provide: USER_REPOSITORY, useExisting: PrismaUserRepository },
    { provide: SESSION_REPOSITORY, useExisting: PrismaSessionRepository },
  ],
  exports: [
    AuthService,
    SessionAuthGuard,
    CsrfOriginGuard,
    USER_REPOSITORY,
    SESSION_REPOSITORY,
  ],
})
export class AuthModule {}
