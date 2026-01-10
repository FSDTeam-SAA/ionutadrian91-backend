import { Injectable } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { AuthUtilsService } from './services/auth-utils.service';
import { AUTH_CONFIG } from './config/auth.config';
import { PrismaService } from '../common/services/prisma.service';
import { ActivityLogService } from '../common/services/activity-log.service';
import { EmailService } from '../common/services/email.service';
import AppError from '../common/errors/app.error';
import * as bcrypt from 'bcryptjs';
import { getRedisClient } from '../common/config/redis.config';
import config from '../common/config/app.config';

@Injectable()
export class AuthService {
  constructor(
    private readonly authUtilsService: AuthUtilsService,
    private readonly prismaService: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly emailService: EmailService,
  ) {}

  async create(
    payload: CreateAuthDto,
    meta: { ip: string; userAgent: string; device?: string },
  ): Promise<void> {
    const { email, password, username } = payload;
    const { ip, userAgent, device } = meta;

    // Check rate limiting for email, IP, and user agent
    const { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS } = AUTH_CONFIG.RATE_LIMIT;
    const { VERIFICATION } = AUTH_CONFIG.TOKEN_EXPIRY;

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
    const newUser = await this.prismaService.$transaction(async (tx) => {
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
    });

    // Store verification code in Redis with expiry
    const redisClient = getRedisClient();
    const verificationKey = `${config.redis_cache_key_prefix}:${AUTH_CONFIG.CACHE_PREFIXES.VERIFICATION_TOKEN}:${email}`;

    await redisClient.setex(
      verificationKey,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      JSON.stringify({
        code: verificationCode,
        userId: newUser.id,
        email: newUser.email,
        expiresAt: expiresAt.toISOString(),
      }),
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

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(id: number, _updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
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
    const redisClient = getRedisClient();
    const verificationKey = `${config.redis_cache_key_prefix}:${AUTH_CONFIG.CACHE_PREFIXES.VERIFICATION_TOKEN}:${email}`;

    // Get verification data from Redis
    const verificationData = await redisClient.get(verificationKey);

    if (!verificationData) {
      throw AppError.badRequest(
        'Verification code expired or invalid. Please request a new code.',
      );
    }

    const parsed = JSON.parse(verificationData) as {
      code: string;
      userId: string;
      email: string;
      expiresAt: string;
    };

    // Validate code
    if (parsed.code !== code) {
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
    await redisClient.del(verificationKey);

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
    const redisClient = getRedisClient();
    const verificationKey = `${config.redis_cache_key_prefix}:${AUTH_CONFIG.CACHE_PREFIXES.VERIFICATION_TOKEN}:${email}`;

    await redisClient.setex(
      verificationKey,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      JSON.stringify({
        code: verificationCode,
        userId: user.id,
        email: user.email,
        expiresAt: expiresAt.toISOString(),
      }),
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
}
