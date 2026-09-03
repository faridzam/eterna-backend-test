import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { DuplicateEmailError } from '../domain/auth.errors.js';
import {
  SessionRepository,
  UserRepository,
} from '../domain/auth.repository.js';
import {
  SessionMetadata,
  SessionRecord,
  UserRecord,
} from '../domain/auth.types.js';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    try {
      return await this.prisma.user.create({ data: input });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DuplicateEmailError();
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    } & SessionMetadata,
  ): Promise<SessionRecord> {
    return this.prisma.session.create({ data: input });
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.prisma.session.findUnique({ where: { tokenHash } });
  }

  async revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  }
}
