import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { isGoogleOAuthConfigured } from './google-oauth.config';
import type { GoogleProfileInput } from './auth.service';

const REFRESH_COOKIE_NAME = 'refreshToken';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Create a CUSTOMER account' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, tokens } = await this.authService.register(
      dto,
      this.extractMeta(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      user: UserResponseDto.fromEntity(user),
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Log in with email + password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, tokens } = await this.authService.login(
      dto,
      this.extractMeta(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      user: UserResponseDto.fromEntity(user),
    };
  }

  // Deliberately NOT rate-limited beyond the global default: this endpoint
  // is called on every page load to restore a session, and a login-strength
  // limit here would lock legitimate users out of their own app.
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token',
  })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, expired, or revoked refresh token',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as
      string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const { user, tokens } = await this.authService.refresh(
      refreshToken,
      this.extractMeta(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      user: UserResponseDto.fromEntity(user),
    };
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as
      string | undefined;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Start Google OAuth login (redirects to Google)' })
  @UseGuards(...(isGoogleOAuthConfigured() ? [AuthGuard('google')] : []))
  googleLogin(): void {
    if (!isGoogleOAuthConfigured()) {
      throw new BadRequestException(
        'Google OAuth is not configured on this server. Set GOOGLE_OAUTH_CLIENT_ID/SECRET to enable it.',
      );
    }
    // Guard performs the redirect to Google; nothing to do here.
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  @UseGuards(...(isGoogleOAuthConfigured() ? [AuthGuard('google')] : []))
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    if (!isGoogleOAuthConfigured()) {
      throw new BadRequestException(
        'Google OAuth is not configured on this server.',
      );
    }

    // This is a full-page browser navigation (Google's redirect), not a
    // fetch call the frontend can catch — an uncaught exception here would
    // otherwise reach the browser as raw JSON from the global exception
    // filter instead of a page the user can make sense of. Redirect to the
    // login page with a generic error flag instead; no account/email
    // details are included, since this URL lands in browser history.
    try {
      const profile = req.user as unknown as GoogleProfileInput;
      const user =
        await this.authService.findOrCreateFromGoogleProfile(profile);
      const tokens = await this.authService.issueTokens(
        user,
        this.extractMeta(req),
      );
      this.setRefreshCookie(res, tokens.refreshToken);

      // The access token deliberately isn't put in this redirect URL (query
      // strings end up in browser history/referrer headers). The frontend
      // lands on this page and immediately calls /auth/refresh, which reads
      // the httpOnly cookie we just set to obtain a fresh access token.
      res.redirect(`${frontendUrl}/auth/callback`);
    } catch (error) {
      this.logger.warn(
        `google oauth callback failed: ${(error as Error).message}`,
      );
      res.redirect(`${frontendUrl}/login?error=google_oauth_failed`);
    }
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: this.authService.getRefreshCookieMaxAgeMs(),
    });
  }

  private extractMeta(req: Request) {
    return {
      userAgent: req.header('user-agent') ?? null,
      ipAddress: req.ip ?? null,
    };
  }
}
