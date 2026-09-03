import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service.js';

interface AttemptWindow {
  count: number;
  startedAt: number;
}

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, AttemptWindow>();

  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    const current = this.attempts.get(key);
    const window =
      current === undefined ||
      now - current.startedAt >= this.config.loginRateLimitWindowMs
        ? { count: 0, startedAt: now }
        : current;
    window.count += 1;
    this.attempts.set(key, window);
    if (window.count > this.config.loginRateLimitMax) {
      throw new HttpException(
        'Too many sign-in attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}