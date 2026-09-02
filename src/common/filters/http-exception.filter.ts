import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const exceptionResponse: unknown = exception.getResponse();
      const message = this.messageFrom(exceptionResponse);
      response.status(exception.getStatus()).json({ status: exception.getStatus(), message, data: null });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred.',
      data: null,
    });
  }

  private messageFrom(response: unknown): string | string[] {
    if (typeof response === 'string') {
      return this.safeMessage(response);
    }
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const message: unknown = response.message;
      if (typeof message === 'string' || (Array.isArray(message) && message.every((item) => typeof item === 'string'))) {
        return Array.isArray(message) ? message.map((item) => this.safeMessage(item)) : this.safeMessage(message);
      }
    }
    return 'Request failed.';
  }

  private safeMessage(message: string): string {
    return /passwordhash|token|secret|stack|database|prisma|sql|authorization/i.test(message)
      ? 'Request failed.'
      : message;
  }
}