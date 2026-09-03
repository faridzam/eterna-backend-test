import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';

class HealthResponseDto {
  @ApiProperty({ example: 'Service is healthy.' })
  message!: string;
  @ApiProperty({ example: { status: 'ok' } })
  data!: { status: 'ok' };
}

@Controller('health')
@ApiTags('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API health' })
  @ApiOkResponse({
    description: 'Service is healthy.',
    schema: {
      example: { message: 'Service is healthy.', data: { status: 'ok' } },
      type: 'object',
    },
    type: HealthResponseDto,
  })
  check() {
    return { message: 'Service is healthy.', data: { status: 'ok' } };
  }
}
