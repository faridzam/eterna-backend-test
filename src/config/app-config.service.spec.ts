import { describe, expect, it } from 'vitest';
import { createAppConfiguration } from './app-config.service.js';

const baseEnvironment = {
  DATABASE_URL: 'postgresql://stockflow:stockflow@localhost:5432/stockflow',
};

describe('createAppConfiguration', () => {
  it('accepts tax rates from zero through one hundred percent', () => {
    expect(
      createAppConfiguration({ ...baseEnvironment, TAX_RATE_BASIS_POINTS: '0' })
        .taxRateBasisPoints,
    ).toBe(0);
    expect(
      createAppConfiguration({
        ...baseEnvironment,
        TAX_RATE_BASIS_POINTS: '10000',
      }).taxRateBasisPoints,
    ).toBe(10_000);
  });

  it('rejects tax rates outside the supported range', () => {
    expect(() =>
      createAppConfiguration({ ...baseEnvironment, TAX_RATE_BASIS_POINTS: '-1' }),
    ).toThrow('TAX_RATE_BASIS_POINTS must be between 0 and 10000.');
    expect(() =>
      createAppConfiguration({
        ...baseEnvironment,
        TAX_RATE_BASIS_POINTS: '10001',
      }),
    ).toThrow('TAX_RATE_BASIS_POINTS must be between 0 and 10000.');
  });
});