import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { message: 'Service is healthy.', data: { status: 'ok' } };
  }
}
