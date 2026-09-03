import { Injectable } from '@nestjs/common';

export interface AppConfiguration {
  readonly corsOrigins: readonly string[];
  readonly databaseUrl: string;
  readonly frontendOrigin: string;
  readonly isProduction: boolean;
  readonly port: number;
  readonly sessionDurationMs: number;
  readonly sessionTokenPepper: string;
  readonly taxRateBasisPoints: number;
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

export function createAppConfiguration(
  environment: NodeJS.ProcessEnv,
): AppConfiguration {
  const nodeEnvironment = environment.NODE_ENV ?? 'development';
  const isProduction = nodeEnvironment === 'production';
  const databaseUrl =
    environment.DATABASE_URL ??
    (isProduction
      ? undefined
      : 'postgresql://stockflow:stockflow@localhost:5432/stockflow?schema=public');
  const frontendOrigin = environment.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  const configuredOrigins = environment.CORS_ORIGINS ?? frontendOrigin;
  const corsOrigins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (
    corsOrigins.length === 0 ||
    !corsOrigins.every((origin) => URL.canParse(origin))
  ) {
    throw new Error('CORS_ORIGINS must contain one or more valid origins.');
  }

  const sessionTokenPepper =
    environment.SESSION_TOKEN_PEPPER ??
    'development-only-session-pepper-change-me';
  if (isProduction && sessionTokenPepper.length < 32) {
    throw new Error(
      'SESSION_TOKEN_PEPPER must be at least 32 characters in production.',
    );
  }

  if (!URL.canParse(frontendOrigin)) {
    throw new Error('FRONTEND_ORIGIN must be a valid origin.');
  }
  if (
    databaseUrl === undefined ||
    !URL.canParse(databaseUrl) ||
    new URL(databaseUrl).protocol !== 'postgresql:'
  ) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  return {
    corsOrigins,
    databaseUrl,
    frontendOrigin,
    isProduction,
    port: positiveInteger(environment.PORT, 8000, 'PORT'),
    sessionDurationMs:
      positiveInteger(
        environment.SESSION_DURATION_HOURS,
        24 * 7,
        'SESSION_DURATION_HOURS',
      ) *
      60 *
      60 *
      1000,
    sessionTokenPepper,
    taxRateBasisPoints: positiveInteger(
      environment.TAX_RATE_BASIS_POINTS,
      1100,
      'TAX_RATE_BASIS_POINTS',
    ),
  };
}

@Injectable()
export class AppConfigService {
  private readonly configuration = createAppConfiguration(process.env);

  get corsOrigins(): readonly string[] {
    return this.configuration.corsOrigins;
  }

  get databaseUrl(): string {
    return this.configuration.databaseUrl;
  }

  get frontendOrigin(): string {
    return this.configuration.frontendOrigin;
  }

  get isProduction(): boolean {
    return this.configuration.isProduction;
  }

  get port(): number {
    return this.configuration.port;
  }

  get sessionDurationMs(): number {
    return this.configuration.sessionDurationMs;
  }

  get sessionTokenPepper(): string {
    return this.configuration.sessionTokenPepper;
  }

  get taxRateBasisPoints(): number {
    return this.configuration.taxRateBasisPoints;
  }
}
