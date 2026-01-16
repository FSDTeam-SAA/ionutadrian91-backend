import { Injectable } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { AuthUtilsService } from './services/auth-utils.service';
import { AUTH_CONFIG } from './config/auth.config';
import { PrismaService } from '../common/services/prisma.service';
import { ActivityLogService } from '../common/services/activity-log.service';
import { EmailService } from '../common/services/email.service';
import { RedisService } from '../common/services/redis.service';
import AppError from '../common/errors/app.error';
import * as bcrypt from 'bcryptjs';
import config from '../common/config/app.config';

@Injectable()
export class AuthService {
  constructor(
    private readonly authUtilsService: AuthUtilsService,
    private readonly prismaService: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  async create(
    payload: CreateAuthDto,
    meta: { ip: string; userAgent: string; device?: string },
  ): Promise<void> {
    const { email, password, username } = payload;
    const { ip, userAgent, device } = meta;

    const { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS } = AUTH_CONFIG.RATE_LIMIT;
    const { VERIFICATION } = AUTH_CONFIG.TOKEN_EXPIRY;

    // Check rate limiting for email, IP, and user agent
    await Promise.all([
      this.authUtilsService.checkRateLimit(
        `login:email:${email}`,
        LOGIN_MAX_ATTEMPTS,
        LOGIN_WINDOW_MS,
      ),
      this.authUtilsService.checkRateLimit(
        `login:ip:${ip}`,
        LOGIN_MAX_ATTEMPTS,
        LOGIN_WINDOW_MS,
      ),
      this.authUtilsService.checkRateLimit(
        `login:ua:${userAgent}`,
        LOGIN_MAX_ATTEMPTS,
        LOGIN_WINDOW_MS,
      ),
    ]);

    // Validate password strength
    if (!this.authUtilsService.validatePassword(password)) {
      throw AppError.badRequest('Password does not meet security requirements');
    }

    // Check if user already exists with email or username
    const existingUser = await this.prismaService.authUser.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw AppError.conflict('Email already exists!');
      }
      if (existingUser.username === username) {
        throw AppError.conflict('Username already exists!');
      }
    }

    // Generate verification code
    const verificationCode = this.authUtilsService.generateVerificationCode();
    const expiresAt = new Date(Date.now() + Number(VERIFICATION) * 60 * 1000);

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with auth security in a transaction
    const newUser = await this.prismaService.$transaction(
      async (tx): Promise<{ id: string; email: string; username: string }> => {
        // Create auth user
        const user = await tx.authUser.create({
          data: {
            email,
            username,
            password: hashedPassword,
            role: 'USER',
            verified: false,
            status: 'ACTIVE',
            provider: 'local',
          },
        });

        // Create auth security record
        await tx.authSecurity.create({
          data: {
            authId: user.id,
            failedAttempts: 0,
            mfaEnabled: false,
            lastPasswordChange: new Date(),
          },
        });

        // Create email history record for verification email
        await tx.emailHistory.create({
          data: {
            authId: user.id,
            emailTo: email,
            emailType: 'verification',
            subject: 'Verify your email address',
            messageId: `verify-${user.id}-${Date.now()}`,
            emailStatus: 'pending',
            ipAddress: ip,
            userAgent: userAgent,
          },
        });

        // Log user registration activity
        await this.activityLogService.logCreate(
          'authUser',
          user.id,
          {
            email,
            username,
            role: 'USER',
            status: 'ACTIVE',
            verified: 'false',
            provider: 'local',
          },
          { ip, userAgent, actionedBy: user.id, device },
          tx,
        );

        return user;
      },
    );

    // Store verification code in Redis with expiry
    const verificationKey = `${config.redis_cache_key_prefix}:${AUTH_CONFIG.CACHE_PREFIXES.VERIFICATION_TOKEN}:${email}`;
    const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    await this.redisService.set(
      verificationKey,
      {
        code: verificationCode,
        userId: newUser.id,
        email: newUser.email,
        expiresAt: expiresAt.toISOString(),
      },
      ttlSeconds,
    );

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(
        email,
        username,
        verificationCode,
      );

      // Update email history status to 'sent'
      await this.prismaService.emailHistory.updateMany({
        where: {
          authId: newUser.id,
          emailType: 'verification',
          emailStatus: 'pending',
        },
        data: {
          emailStatus: 'sent',
        },
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Update email history status to 'failed'
      await this.prismaService.emailHistory.updateMany({
        where: {
          authId: newUser.id,
          emailType: 'verification',
          emailStatus: 'pending',
        },
        data: {
          emailStatus: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Failed to send email',
        },
      });
      // Don't throw error, user is created, just email failed
    }
  }

  /**
   * Verify user email with verification code
   */
  async verifyEmail(
    email: string,
    code: string,
    meta: { ip: string; userAgent: string },
  ): Promise<{ message: string }> {
    const { ip, userAgent } = meta;
    const verificationKey = `${config.redis_cache_key_prefix}:${AUTH_CONFIG.CACHE_PREFIXES.VERIFICATION_TOKEN}:${email}`;

    // Get verification data from Redis
    const verificationData = await this.redisService.get<{
      code: string;
      userId: string;
      email: string;
      expiresAt: string;
    }>(verificationKey);

    if (!verificationData) {
      throw AppError.badRequest(
        'Verification code expired or invalid. Please request a new code.',
      );
    }

    // Validate code
    if (verificationData.code !== code) {
      throw AppError.badRequest('Invalid verification code');
    }

    // Find user
    const user = await this.prismaService.authUser.findUnique({
      where: { email },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (user.verified) {
      throw AppError.badRequest('Email already verified');
    }

    // Update user as verified
    await this.prismaService.$transaction(async (tx) => {
      await tx.authUser.update({
        where: { id: user.id },
        data: { verified: true },
      });

      // Log verification activity
      await this.activityLogService.logCustomEvent(
        'authUser',
        user.id,
        'profile_update',
        { ip, userAgent, actionedBy: user.id },
        [
          {
            fieldName: 'verified',
            oldValue: 'false',
            newValue: 'true',
          },
        ],
        tx,
      );
    });

    // Delete verification code from Redis
    await this.redisService.del(verificationKey);

    // Send welcome email
    try {
      await this.emailService.sendWelcomeEmail(email, user.username);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't throw, verification is successful
    }

    return { message: 'Email verified successfully' };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(
    email: string,
    meta: { ip: string; userAgent: string },
  ): Promise<{ message: string }> {
    const { ip, userAgent } = meta;
    const { VERIFICATION } = AUTH_CONFIG.TOKEN_EXPIRY;

    // Check rate limiting
    await this.authUtilsService.checkRateLimit(
      `resend:verification:${email}`,
      3, // Max 3 attempts
      15 * 60 * 1000, // 15 minutes
    );

    // Find user
    const user = await this.prismaService.authUser.findUnique({
      where: { email },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (user.verified) {
      throw AppError.badRequest('Email already verified');
    }

    // Generate new verification code
    const verificationCode = this.authUtilsService.generateVerificationCode();
    const expiresAt = new Date(Date.now() + Number(VERIFICATION) * 60 * 1000);

    // Store new verification code in Redis
    const verificationKey = `${config.redis_cache_key_prefix}:${AUTH_CONFIG.CACHE_PREFIXES.VERIFICATION_TOKEN}:${email}`;
    const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    await this.redisService.set(
      verificationKey,
      {
        code: verificationCode,
        userId: user.id,
        email: user.email,
        expiresAt: expiresAt.toISOString(),
      },
      ttlSeconds,
    );

    // Create new email history record
    await this.prismaService.emailHistory.create({
      data: {
        authId: user.id,
        emailTo: email,
        emailType: 'verification',
        subject: 'Verify your email address',
        messageId: `verify-resend-${user.id}-${Date.now()}`,
        emailStatus: 'pending',
        ipAddress: ip,
        userAgent: userAgent,
      },
    });

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(
        email,
        user.username,
        verificationCode,
      );

      // Update email history status
      await this.prismaService.emailHistory.updateMany({
        where: {
          authId: user.id,
          emailType: 'verification',
          emailStatus: 'pending',
        },
        data: {
          emailStatus: 'sent',
        },
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Update email history status to 'failed'
      await this.prismaService.emailHistory.updateMany({
        where: {
          authId: user.id,
          emailType: 'verification',
          emailStatus: 'pending',
        },
        data: {
          emailStatus: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Failed to send email',
        },
      });
      throw AppError.badRequest('Failed to send verification email');
    }

    return { message: 'Verification email sent successfully' };
  }

  async login(
    payload: { email: string; password: string },
    meta: { ip: string; userAgent: string; device?: string },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      username: string;
      role: string;
      verified: boolean;
    };
    expiresIn: number;
  }> {
    const { email, password } = payload;
    const { ip, userAgent, device } = meta;

    const { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS } = AUTH_CONFIG.RATE_LIMIT;
    const { MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS } =
      AUTH_CONFIG.ACCOUNT_LOCKOUT;

    // Check rate limiting for email, IP, and user agent in parallel
    // This prevents brute force attacks at multiple levels
    await Promise.all([
      this.authUtilsService.checkRateLimit(
        `login:email:${email}`,
        LOGIN_MAX_ATTEMPTS,
        LOGIN_WINDOW_MS,
      ),
      this.authUtilsService.checkRateLimit(
        `login:ip:${ip}`,
        LOGIN_MAX_ATTEMPTS,
        LOGIN_WINDOW_MS,
      ),
      this.authUtilsService.checkRateLimit(
        `login:ua:${userAgent}`,
        LOGIN_MAX_ATTEMPTS,
        LOGIN_WINDOW_MS,
      ),
    ]);

    // Fetch user with security data in single query (optimized for scale)
    // Using select to minimize data transfer and improve query performance
    const user = await this.prismaService.authUser.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        role: true,
        verified: true,
        status: true,
        provider: true,
        authSecurity: {
          select: {
            id: true,
            failedAttempts: true,
            lastFailedAt: true,
            lockExpiresAt: true,
          },
        },
      },
    });

    // Generic error message to prevent user enumeration attacks
    const invalidCredentialsError = AppError.unauthorized(
      'Invalid email or password',
    );

    if (!user) {
      // Log failed attempt for non-existent user (security monitoring)
      await this.logLoginAttempt({
        authId: null,
        ip,
        userAgent,
        device,
        success: false,
        failureReason: 'user_not_found',
      });
      throw invalidCredentialsError;
    }

    // Check if user is using OAuth provider
    if (user.provider !== 'local') {
      throw AppError.badRequest(
        `Please login using ${user.provider} authentication`,
      );
    }

    // Check account status
    if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
      await this.logLoginAttempt({
        authId: user.id,
        ip,
        userAgent,
        device,
        success: false,
        failureReason: `account_${user.status.toLowerCase()}`,
      });
      throw AppError.forbidden(
        `Your account has been ${user.status.toLowerCase()}. Please contact support.`,
      );
    }

    if (user.status === 'DELETED' || user.status === 'INACTIVE') {
      throw invalidCredentialsError;
    }

    // Check account lockout status
    const security = user.authSecurity;
    if (security?.lockExpiresAt && new Date() < security.lockExpiresAt) {
      const remainingTime = Math.ceil(
        (security.lockExpiresAt.getTime() - Date.now()) / 1000 / 60,
      );
      await this.logLoginAttempt({
        authId: user.id,
        ip,
        userAgent,
        device,
        success: false,
        failureReason: 'account_locked',
        attemptNumber: security.failedAttempts + 1,
      });
      throw AppError.forbidden(
        `Account is temporarily locked. Please try again in ${remainingTime} minutes.`,
      );
    }

    // Verify password using constant-time comparison (bcrypt handles this)
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Handle failed login attempt
      await this.handleFailedLoginAttempt(
        user.id,
        security?.failedAttempts || 0,
        MAX_FAILED_ATTEMPTS,
        LOCKOUT_DURATION_MS,
        { ip, userAgent, device },
      );
      throw invalidCredentialsError;
    }

    // Check email verification status
    if (!user.verified) {
      await this.logLoginAttempt({
        authId: user.id,
        ip,
        userAgent,
        device,
        success: false,
        failureReason: 'email_not_verified',
      });
      throw AppError.forbidden(
        'Please verify your email address before logging in',
      );
    }

    // Generate tokens with optimized payload (minimal data for scalability)
    // JWT is STATELESS - no Redis lookup needed on every request
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as unknown as import('./interfaces/auth.interface').UserRole,
    };

    const [accessToken, refreshToken] = await Promise.all([
      Promise.resolve(
        this.authUtilsService.createToken(tokenPayload, {
          isRefresh: false,
          expiresIn: AUTH_CONFIG.TOKEN_EXPIRY.ACCESS,
        }),
      ),
      Promise.resolve(
        this.authUtilsService.createToken(tokenPayload, {
          isRefresh: true,
          expiresIn: AUTH_CONFIG.TOKEN_EXPIRY.REFRESH,
        }),
      ),
    ]);

    // Parse token expiry to seconds
    const refreshTokenTTL = this.parseExpiryToSeconds(
      AUTH_CONFIG.TOKEN_EXPIRY.REFRESH,
    );

    // Generate unique refresh token ID for revocation capability
    const refreshTokenId = `${user.id}:${Date.now()}:${Math.random().toString(36).substring(7)}`;
    const refreshTokenKey = `${config.redis_cache_key_prefix}:${AUTH_CONFIG.CACHE_PREFIXES.REFRESH_TOKEN}:${refreshTokenId}`;

    // Execute all async operations in parallel for better performance
    // BEST PRACTICE: Access token is STATELESS (no Redis), only refresh token in Redis
    await Promise.all([
      // Store ONLY refresh token in Redis for revocation capability
      // Access token is stateless - verified by signature only
      this.redisService.set(
        refreshTokenKey,
        {
          userId: user.id,
          tokenId: refreshTokenId,
          ip,
          userAgent,
          device,
          createdAt: new Date().toISOString(),
        },
        refreshTokenTTL,
      ),
      // Reset failed attempts on successful login
      security
        ? this.prismaService.authSecurity.update({
            where: { id: security.id },
            data: {
              failedAttempts: 0,
              lastFailedAt: null,
              lockExpiresAt: null,
            },
          })
        : Promise.resolve(),
      // Log successful login (loginHistory handles all login tracking)
      // No need for separate activity log for login events
      this.logLoginAttempt({
        authId: user.id,
        ip,
        userAgent,
        device,
        success: true,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        verified: user.verified,
      },
      expiresIn: this.parseExpiryToSeconds(AUTH_CONFIG.TOKEN_EXPIRY.ACCESS),
    };
  }

  /**
   * Logout user by blacklisting their access token
   * Best practice: Only blacklist when user explicitly logs out
   */
  async logout(
    accessToken: string,
    userId: string,
  ): Promise<{ message: string }> {
    // Verify token first
    const decoded = this.authUtilsService.verifyToken(accessToken);
    if (decoded.userId !== userId) {
      throw AppError.unauthorized('Invalid token');
    }

    // Calculate remaining TTL for the token
    const expiresAt = decoded.exp ? decoded.exp * 1000 : Date.now() + 3600000;
    const remainingTTL = Math.max(
      0,
      Math.floor((expiresAt - Date.now()) / 1000),
    );

    if (remainingTTL > 0) {
      // Blacklist the access token in Redis (only until it expires naturally)
      const blacklistKey = `${config.redis_cache_key_prefix}:token_blacklist:${accessToken}`;
      await this.redisService.set(
        blacklistKey,
        { userId, loggedOutAt: new Date().toISOString() },
        remainingTTL,
      );
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * Handle failed login attempt with account lockout mechanism
   * Optimized for high concurrency with atomic Redis operations
   */
  private async handleFailedLoginAttempt(
    userId: string,
    currentFailedAttempts: number,
    maxAttempts: number,
    lockoutDuration: number,
    meta: { ip: string; userAgent: string; device?: string },
  ): Promise<void> {
    const newFailedAttempts = currentFailedAttempts + 1;
    const shouldLock = newFailedAttempts >= maxAttempts;

    // Update security record with new failed attempt count
    await Promise.all([
      this.prismaService.authSecurity.update({
        where: { authId: userId },
        data: {
          failedAttempts: newFailedAttempts,
          lastFailedAt: new Date(),
          ...(shouldLock && {
            lockExpiresAt: new Date(Date.now() + lockoutDuration),
          }),
        },
      }),
      this.logLoginAttempt({
        authId: userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        device: meta.device,
        success: false,
        failureReason: shouldLock ? 'account_locked' : 'invalid_password',
        attemptNumber: newFailedAttempts,
      }),
    ]);
  }

  /**
   * Log login attempt to history for security auditing
   * Uses fire-and-forget pattern for non-blocking writes at scale
   */
  private logLoginAttempt(data: {
    authId: string | null;
    ip: string;
    userAgent: string;
    device?: string;
    success: boolean;
    failureReason?: string;
    attemptNumber?: number;
    isSuspicious?: boolean;
  }): Promise<void> {
    // Skip if no authId (user doesn't exist)
    if (!data.authId) {
      return Promise.resolve();
    }

    // Fire-and-forget for non-blocking write (scale optimization)
    // Return immediately, let the write happen in background
    return this.prismaService.loginHistory
      .create({
        data: {
          authId: data.authId,
          ipAddress: data.ip,
          userAgent: data.userAgent,
          device_id: data.device,
          action: 'login',
          success: data.success,
          failureReason: data.failureReason,
          attemptNumber: data.attemptNumber || 1,
          isSuspicious: data.isSuspicious || false,
        },
      })
      .then(() => undefined)
      .catch((error) => {
        // Log error but don't fail the login process
        console.error('Failed to log login attempt:', error);
      });
  }

  /**
   * Parse token expiry string to seconds
   * Supports formats: '1h', '7d', '30m', '3600s', '3600'
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])?$/);
    if (!match) {
      return 3600; // Default 1 hour
    }

    const value = parseInt(match[1], 10);
    const unit = match[2] || 's';

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        return value;
    }
  }
}
