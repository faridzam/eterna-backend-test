import { SessionMetadata, SessionRecord, UserRecord } from './auth.types.js';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface UserRepository {
  create(input: {
    name: string;
    email: string;
    passwordHash: string;
    role?: import('./auth.types.js').UserRole;
  }): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export interface SessionRepository {
  create(
    input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    } & SessionMetadata,
  ): Promise<SessionRecord>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
}
