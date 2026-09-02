import { ApiProperty } from '@nestjs/swagger';

export class RegisteredUserDto {
  @ApiProperty({ example: 'user-1' })
  declare id: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  declare name: string;

  @ApiProperty({ example: 'ada@example.com' })
  declare email: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', format: 'date-time' })
  declare createdAt: string;
}

export class RegisterResponseDto {
  @ApiProperty({ example: 'Account created successfully. Please sign in.' })
  declare message: string;

  @ApiProperty({ type: RegisteredUserDto })
  declare data: RegisteredUserDto;
}