import { CookieOptions } from 'express';
import { AppConfigService } from '../config/app-config.service.js';

export const SESSION_COOKIE_NAME = 'stockflow_session';

export function sessionCookieOptions(
  config: AppConfigService,
  expiresAt: Date,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    expires: expiresAt,
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  };
}

export function clearSessionCookieOptions(
  config: AppConfigService,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
  };
}
