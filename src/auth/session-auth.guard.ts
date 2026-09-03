import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service.js';
import { AuthenticatedUser } from './domain/auth.types.js';
import { SESSION_COOKIE_NAME } from './session-cookie.js';

export interface AuthenticatedRequest extends Request {
  authenticatedUser?: AuthenticatedUser;
}

function readCookie(request: Request, cookieName: string): string | undefined {
  const cookies: unknown = request.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }
  const value: unknown = Reflect.get(cookies, cookieName);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawToken = readCookie(request, SESSION_COOKIE_NAME);
    const user =
      rawToken === undefined
        ? null
        : await this.authService.getAuthenticatedUser(rawToken);
    if (user === null) {
      throw new UnauthorizedException('Authentication is required.');
    }
    request.authenticatedUser = user;
    return true;
  }
}
