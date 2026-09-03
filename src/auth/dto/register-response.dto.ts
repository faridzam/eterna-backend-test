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

export class AuthenticatedUserDto extends RegisteredUserDto {
  @ApiProperty({ enum: ['ADMIN', 'STAFF'], example: 'STAFF' })
  declare role: 'ADMIN' | 'STAFF';
}

export class LoginResponseDto {
  @ApiProperty({ example: 'Signed in successfully.' })
  declare message: string;

  @ApiProperty({ type: AuthenticatedUserDto })
  declare data: { user: AuthenticatedUserDto };
}

export class MeResponseDto {
  @ApiProperty({ example: 'Authenticated user retrieved successfully.' })
  declare message: string;

  @ApiProperty({ type: AuthenticatedUserDto })
  declare data: AuthenticatedUserDto;
}

export class LogoutResponseDto {
  @ApiProperty({ example: 'Signed out successfully.', nullable: false })
  declare message: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: false,
    nullable: true,
    example: null,
  })
  declare data: null;
}

export class RegisterResponseDto {
  @ApiProperty({ example: 'Account created successfully. Please sign in.' })
  declare message: string;

  @ApiProperty({ type: RegisteredUserDto })
  declare data: RegisteredUserDto;
}
