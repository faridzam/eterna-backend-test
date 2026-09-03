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
import {
    ApiBadRequestResponse,
    ApiCookieAuth,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiOperation,
    ApiResponse,
    ApiTags,
    ApiTooManyRequestsResponse,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service.js';
import { AuthService } from './auth.service.js';
import { CsrfOriginGuard } from './csrf-origin.guard.js';
import { LoginDto } from './dto/login.dto.js';
import {
    LoginResponseDto,
    LogoutResponseDto,
    MeResponseDto,
    RegisterResponseDto,
} from './dto/register-response.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginRateLimitGuard } from './login-rate-limit.guard.js';
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
@ApiTags('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Create an account' })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid registration input.' })
  @ApiResponse({
    status: 409,
    description: 'An account already exists for that email address.',
  })
  async register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in and create a session' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid login input.' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts.' })
  @UseGuards(LoginRateLimitGuard)
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
    return {
      message: 'Signed in successfully.',
      data: { user: result.user },
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Read the authenticated user' })
  @ApiCookieAuth('stockflow_session')
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @UseGuards(SessionAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return {
      message: 'Authenticated user retrieved successfully.',
      data: request.authenticatedUser,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign out and revoke the current session' })
  @ApiCookieAuth('stockflow_session')
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Request origin is not trusted.' })
  @UseGuards(CsrfOriginGuard)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
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
    return { message: 'Signed out successfully.', data: null };
  }
}
