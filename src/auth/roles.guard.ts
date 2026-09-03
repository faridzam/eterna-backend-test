import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from './domain/auth.types.js';
import { REQUIRED_ROLES } from './roles.decorator.js';
import { AuthenticatedRequest } from './session-auth.guard.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(
      REQUIRED_ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (required === undefined || required.length === 0) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (
      request.authenticatedUser === undefined ||
      !required.includes(request.authenticatedUser.role)
    ) {
      throw new ForbiddenException('You are not allowed to perform this action.');
    }
    return true;
  }
}