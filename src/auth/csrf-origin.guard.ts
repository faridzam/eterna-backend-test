import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AppConfigService } from '../config/app-config.service.js';

function headerValue(request: Request, headerName: string): string | undefined {
  const header = request.headers[headerName];
  return typeof header === 'string' ? header : undefined;
}

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return true;
    }

    const origin = headerValue(request, 'origin');
    const referer = headerValue(request, 'referer');
    const requestOrigin = origin ?? this.originFromReferer(referer);
    if (requestOrigin === undefined || !this.config.corsOrigins.includes(requestOrigin)) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
    return true;
  }

  private originFromReferer(referer: string | undefined): string | undefined {
    if (referer === undefined || !URL.canParse(referer)) {
      return undefined;
    }
    return new URL(referer).origin;
  }
}