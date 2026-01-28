import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import {
  GoogleOAuthInitDto,
  GoogleOAuthCallbackDto,
} from './dto/google-oauth.dto';
import type { Request, Response } from 'express';
import { CustomLoggerService } from '../common/services/custom-logger.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly customLogger: CustomLoggerService,
  ) {}

  @Post()
  create(@Body() payload: CreateAuthDto, @Req() req: Request) {
    this.customLogger.log(
      `Registration attempt for email: ${payload.email}`,
      'AuthController',
    );
    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      device:
        (Array.isArray(req.headers['x-device'])
          ? req.headers['x-device'][0]
          : req.headers['x-device']) ||
        (Array.isArray(req.headers['x-device-id'])
          ? req.headers['x-device-id'][0]
          : req.headers['x-device-id']) ||
        (Array.isArray(req.headers['sec-ch-ua-platform'])
          ? req.headers['sec-ch-ua-platform'][0]
          : req.headers['sec-ch-ua-platform']),
    };
    return this.authService.create(payload, meta);
  }

  @Post('verify-email')
  verifyEmail(
    @Body('email') email: string,
    @Body('code') code: string,
    @Req() req: Request,
  ) {
    this.customLogger.log(
      `Email verification attempt for: ${email}`,
      'AuthController',
    );
    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };
    return this.authService.verifyEmail(email, code, meta);
  }

  @Post('resend-verification-email')
  resendVerificationEmail(@Body('email') email: string, @Req() req: Request) {
    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };
    return this.authService.resendVerificationEmail(email, meta);
  }

  // ==========================================
  // Google OAuth Endpoints
  // ==========================================

  /**
   * Initiate Google OAuth flow
   * Returns the Google authorization URL for the client to redirect to
   *
   * @example GET /auth/google
   * @example GET /auth/google?redirectUrl=http://localhost:3000/dashboard
   */
  @Get('google')
  async googleOAuthInit(
    @Query() query: GoogleOAuthInitDto,
    @Req() req: Request,
  ) {
    this.customLogger.log(
      'Google OAuth initialization requested',
      'AuthController',
    );

    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    const { url, state } = await this.googleOAuthService.getAuthorizationUrl(
      meta,
      query.redirectUrl,
    );

    return {
      url,
      state,
      message: 'Redirect to the provided URL to authenticate with Google',
    };
  }

  /**
   * Google OAuth callback handler
   * This endpoint is called by Google after user authentication
   *
   * For browser-based flows, this redirects to the frontend
   * For API-based flows, returns JSON with tokens
   */
  @Get('google/callback')
  async googleOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Handle OAuth errors
    if (error) {
      this.customLogger.warn(
        `Google OAuth error: ${error} - ${errorDescription}`,
        'AuthController',
      );

      // For browser redirect, you might want to redirect to an error page
      return {
        success: false,
        error,
        errorDescription,
        message: 'Google authentication failed',
      };
    }

    if (!code || !state) {
      return {
        success: false,
        error: 'missing_parameters',
        message: 'Missing authorization code or state parameter',
      };
    }

    this.customLogger.log('Google OAuth callback received', 'AuthController');

    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      device:
        (Array.isArray(req.headers['x-device'])
          ? req.headers['x-device'][0]
          : req.headers['x-device']) ||
        (Array.isArray(req.headers['x-device-id'])
          ? req.headers['x-device-id'][0]
          : req.headers['x-device-id']) ||
        (Array.isArray(req.headers['sec-ch-ua-platform'])
          ? req.headers['sec-ch-ua-platform'][0]
          : req.headers['sec-ch-ua-platform']),
    };

    const result = await this.googleOAuthService.handleCallback(
      code,
      state,
      meta,
    );

    return {
      success: true,
      message: result.isNewUser
        ? 'Account created successfully via Google'
        : 'Signed in successfully via Google',
      data: result,
    };
  }

  /**
   * Alternative POST endpoint for Google OAuth callback
   * Useful for mobile apps or SPAs that handle the callback differently
   */
  @Post('google/callback')
  async googleOAuthCallbackPost(
    @Body() body: GoogleOAuthCallbackDto,
    @Req() req: Request,
  ) {
    this.customLogger.log(
      'Google OAuth callback (POST) received',
      'AuthController',
    );

    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      device:
        (Array.isArray(req.headers['x-device'])
          ? req.headers['x-device'][0]
          : req.headers['x-device']) ||
        (Array.isArray(req.headers['x-device-id'])
          ? req.headers['x-device-id'][0]
          : req.headers['x-device-id']) ||
        (Array.isArray(req.headers['sec-ch-ua-platform'])
          ? req.headers['sec-ch-ua-platform'][0]
          : req.headers['sec-ch-ua-platform']),
    };

    const result = await this.googleOAuthService.handleCallback(
      body.code,
      body.state,
      meta,
    );

    return {
      success: true,
      message: result.isNewUser
        ? 'Account created successfully via Google'
        : 'Signed in successfully via Google',
      data: result,
    };
  }

  // ==========================================
  // Login/Logout Endpoints
  // ==========================================

  /**
   * Login with email and password
   */
  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
    @Req() req: Request,
  ) {
    this.customLogger.log(
      `Login attempt for email: ${email}`,
      'AuthController',
    );

    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      device:
        (Array.isArray(req.headers['x-device'])
          ? req.headers['x-device'][0]
          : req.headers['x-device']) ||
        (Array.isArray(req.headers['x-device-id'])
          ? req.headers['x-device-id'][0]
          : req.headers['x-device-id']) ||
        (Array.isArray(req.headers['sec-ch-ua-platform'])
          ? req.headers['sec-ch-ua-platform'][0]
          : req.headers['sec-ch-ua-platform']),
    };

    const result = await this.authService.login({ email, password }, meta);

    return {
      success: true,
      message: 'Login successful',
      data: result,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  @Post('refresh-token')
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request,
  ) {
    this.customLogger.log('Token refresh requested', 'AuthController');

    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      device:
        (Array.isArray(req.headers['x-device'])
          ? req.headers['x-device'][0]
          : req.headers['x-device']) ||
        (Array.isArray(req.headers['x-device-id'])
          ? req.headers['x-device-id'][0]
          : req.headers['x-device-id']) ||
        (Array.isArray(req.headers['sec-ch-ua-platform'])
          ? req.headers['sec-ch-ua-platform'][0]
          : req.headers['sec-ch-ua-platform']),
    };

    const result = await this.authService.refreshToken(refreshToken, meta);

    return {
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    };
  }

  /**
   * Logout current session
   */
  @Post('logout')
  async logout(
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request,
  ) {
    this.customLogger.log('Logout requested', 'AuthController');

    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    const result = await this.authService.logout(refreshToken, meta);

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Logout from all devices
   */
  @Post('logout-all')
  async logoutAll(@Body('userId') userId: string) {
    this.customLogger.log(
      `Logout all devices requested for user: ${userId}`,
      'AuthController',
    );

    const result = await this.authService.logoutAllDevices(userId);

    return {
      success: true,
      ...result,
    };
  }
}
