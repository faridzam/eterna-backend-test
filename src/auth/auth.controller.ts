import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service.js';
import { AuthService } from './auth.service.js';
import { CsrfOriginGuard } from './csrf-origin.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterResponseDto } from './dto/register-response.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import {
  clearSessionCookieOptions,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from './session-cookie.js';

function optionalHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' && value.length > 0
    ? value.slice(0, 512)
    : undefined;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Post('register')
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid registration input.' })
  @ApiResponse({
    status: 409,
    description: 'An account already exists for that email address.',
  })
  async register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(input, {
      userAgent: optionalHeader(request, 'user-agent'),
      ipAddress: request.ip,
    });
    response.cookie(
      SESSION_COOKIE_NAME,
      result.rawToken,
      sessionCookieOptions(this.config, result.expiresAt),
    );
    return { data: { user: result.user } };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return { data: request.authenticatedUser };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(CsrfOriginGuard)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookies: unknown = request.cookies;
    const value: unknown =
      typeof cookies === 'object' && cookies !== null
        ? Reflect.get(cookies, SESSION_COOKIE_NAME)
        : undefined;
    await this.authService.logout(
      typeof value === 'string' ? value : undefined,
    );
    response.clearCookie(
      SESSION_COOKIE_NAME,
      clearSessionCookieOptions(this.config),
    );
  }
}
