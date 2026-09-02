import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { describe, expect, it } from 'vitest';
import { AppConfigService } from '../config/app-config.service.js';
import { CsrfOriginGuard } from './csrf-origin.guard.js';

describe('CsrfOriginGuard', () => {
  const guard = new CsrfOriginGuard(new AppConfigService());

  it('accepts an allowed frontend origin and same-origin referer', () => {
    expect(guard.canActivate(new ExecutionContextHost([{ method: 'POST', headers: { origin: 'http://localhost:3000' } }]))).toBe(true);
    expect(guard.canActivate(new ExecutionContextHost([{ method: 'PATCH', headers: { referer: 'http://localhost:3000/products/1' } }]))).toBe(true);
  });

  it('rejects missing and untrusted origins for state-changing requests', () => {
    expect(() => guard.canActivate(new ExecutionContextHost([{ method: 'DELETE', headers: {} }]))).toThrow('Request origin is not allowed.');
    expect(() => guard.canActivate(new ExecutionContextHost([{ method: 'POST', headers: { origin: 'https://attacker.example' } }]))).toThrow('Request origin is not allowed.');
  });
});