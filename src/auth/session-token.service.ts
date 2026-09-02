import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { AppConfigService } from '../config/app-config.service.js';

@Injectable()
export class SessionTokenService {
  constructor(private readonly config: AppConfigService) {}

  createRawToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(rawToken: string): string {
    return createHmac('sha256', this.config.sessionTokenPepper).update(rawToken).digest('hex');
  }
}