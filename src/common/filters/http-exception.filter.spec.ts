import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter.js';

function responseDouble() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = {
    status,
    json,
  };
  return response;
}

describe('HttpExceptionFilter', () => {
  it('normalizes validation messages and masks sensitive exception text', () => {
    const filter = new HttpExceptionFilter();
    const response = responseDouble();
    filter.catch(
      new BadRequestException(['email must be an email']),
      new ExecutionContextHost([{}, response]),
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      status: 400,
      message: ['email must be an email'],
      data: null,
    });

    const sensitiveResponse = responseDouble();
    filter.catch(
      new InternalServerErrorException('database passwordHash token'),
      new ExecutionContextHost([{}, sensitiveResponse]),
    );
    expect(sensitiveResponse.status).toHaveBeenCalledWith(500);
    expect(sensitiveResponse.json).toHaveBeenCalledWith({
      status: 500,
      message: 'Request failed.',
      data: null,
    });
  });
});
