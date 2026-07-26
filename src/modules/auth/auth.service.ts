import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomInt, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import config from '../../common/config/app.config';
import { MongoService } from '../../common/services/mongo.service';
import { RedisService } from '../../common/services/redis.service';
import { UserRole, UserStatus } from '../../common/schemas';
import { EmailQueueService } from '../../common/queues/email/email.queue';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { OtpPurpose, ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  AuthResponse,
  AuthenticatedUser,
  ClientPlatform,
  PublicUser,
  TokenPair,
} from './interfaces/auth.interface';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_CACHE_SECONDS = 7 * 24 * 60 * 60;
const BCRYPT_ROUNDS = 12;
const OTP_TTL_MS = 10 * 60 * 1000;
const VERIFY_EMAIL_OTP_TTL_MS = 24 * 60 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

type OtpKind = 'email-verification' | 'password-reset';

interface OtpRecord {
  hash: string;
  expiresAt: string;
}

interface ResetTokenRecord {
  hash: string;
  expiresAt: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly mongo: MongoService,
    private readonly redis: RedisService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ user: PublicUser; verificationRequired: true }> {
    await this.assertUniqueIdentity(dto.email, dto.username);

    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.mongo.authUser.create({
      data: {
        email: dto.email.toLowerCase(),
        username: dto.username,
        password,
        role: UserRole.Field,
        status: UserStatus.Active,
        verified: false,
        provider: 'local',
        tokenVersion: 0,
      },
    });

    const otp = this.generateOtp();
    const otpRecord = await this.createOtpRecord(otp, VERIFY_EMAIL_OTP_TTL_MS);
    await this.mongo.authSecurity.create({
      data: {
        authId: user.id,
        failedAttempts: 0,
        mfaEnabled: false,
        lastPasswordChange: new Date(),
        emailVerificationOtpHash: otpRecord.hash,
        emailVerificationOtpExpiresAt: new Date(otpRecord.expiresAt),
        emailVerificationOtpLastSentAt: new Date(),
      },
    });
    await this.storeOtpInRedis(user.id, 'email-verification', otpRecord);
    await this.mongo.userProfile.create({
      data: {
        authId: user.id,
        firstName: dto.firstName || '',
        lastName: dto.lastName || '',
      },
    });

    await this.recordEmail(user.id, user.email, 'verification');
    await this.emailQueue.sendVerificationEmail(
      user.email,
      user.username,
      otp,
      user.id,
    );

    return {
      user: this.toPublicUser(await this.findUserWithProfile(user.id)),
      verificationRequired: true,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ verified: true }> {
    const user = await this.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (user.verified) {
      await this.clearStoredOtp(user.id, 'email-verification');
      return { verified: true };
    }

    const security = user.authSecurity;
    await this.assertValidOtpForUser(
      user.id,
      'email-verification',
      dto.otp,
      security?.emailVerificationOtpHash,
      security?.emailVerificationOtpExpiresAt,
    );

    await this.mongo.authUser.update({
      where: { id: user.id },
      data: { verified: true },
    });
    await this.clearStoredOtp(user.id, 'email-verification');
    await this.emailQueue.sendWelcomeEmail(user.email, user.username, user.id);

    return { verified: true };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.mongo.authUser.findFirst({
      where: {
        email: dto.email.toLowerCase(),
      },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.Active) {
      throw new ForbiddenException('User account is not active');
    }

    if (!user.verified) {
      throw new ForbiddenException('Email verification is required');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      await this.recordFailedLogin(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.assertRoleCanUsePlatform(
      user.role as UserRole,
      dto.clientPlatform || ClientPlatform.Web,
    );

    await this.resetFailedLogins(user.id);
    return this.buildAuthResponse(await this.findUserWithProfile(user.id));
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ otpSentIfAccountExists: true }> {
    const user = await this.findByEmail(dto.email);
    if (
      user &&
      user.status === UserStatus.Active &&
      user.provider === 'local' &&
      user.verified
    ) {
      try {
        await this.issuePasswordResetOtp(user);
      } catch (error) {
        if (!(error instanceof BadRequestException)) {
          throw error;
        }
      }
    }

    return { otpSentIfAccountExists: true };
  }

  async verifyPasswordResetOtp(
    dto: VerifyOtpDto,
  ): Promise<{ verified: true; resetToken: string; expiresIn: number }> {
    const user = await this.findByEmail(dto.email);
    if (
      !user ||
      user.status !== UserStatus.Active ||
      user.provider !== 'local' ||
      !user.verified
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.assertValidOtpForUser(
      user.id,
      'password-reset',
      dto.otp,
      user.authSecurity?.passwordResetOtpHash,
      user.authSecurity?.passwordResetOtpExpiresAt,
    );

    await this.clearStoredOtp(user.id, 'password-reset');
    const { token, expiresIn } = await this.issuePasswordResetToken(user.id);

    return {
      verified: true,
      resetToken: token,
      expiresIn,
    };
  }

  async resendOtp(dto: ResendOtpDto): Promise<{ otpSent: true }> {
    const user = await this.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('Unable to send OTP');
    }

    if (dto.purpose === OtpPurpose.VerifyEmail) {
      if (user.verified) {
        throw new BadRequestException('Email is already verified');
      }

      await this.assertCanResend(
        user.authSecurity?.emailVerificationOtpLastSentAt,
      );
      const otp = this.generateOtp();
      const otpRecord = await this.createOtpRecord(
        otp,
        VERIFY_EMAIL_OTP_TTL_MS,
      );
      await this.mongo.authSecurity.update({
        where: { authId: user.id },
        data: {
          emailVerificationOtpHash: otpRecord.hash,
          emailVerificationOtpExpiresAt: new Date(otpRecord.expiresAt),
          emailVerificationOtpLastSentAt: new Date(),
        },
      });
      await this.storeOtpInRedis(user.id, 'email-verification', otpRecord);
      await this.recordEmail(user.id, user.email, 'verification');
      await this.emailQueue.sendVerificationEmail(
        user.email,
        user.username,
        otp,
        user.id,
      );
      return { otpSent: true };
    }

    if (!user.verified || user.status !== UserStatus.Active) {
      throw new BadRequestException('Unable to send OTP');
    }

    await this.assertCanResend(user.authSecurity?.passwordResetOtpLastSentAt);
    await this.issuePasswordResetOtp(user);
    return { otpSent: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ changed: true }> {
    const user = await this.findByEmail(dto.email);
    if (
      !user ||
      user.status !== UserStatus.Active ||
      user.provider !== 'local'
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.assertPasswordResetAuthorization(user, dto);

    const passwordMatches = await bcrypt.compare(
      dto.newPassword,
      user.password,
    );
    if (passwordMatches) {
      throw new BadRequestException('New password must be different');
    }

    const password = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    const updated = await this.mongo.authUser.update({
      where: { id: user.id },
      data: {
        password,
        tokenVersion: { increment: 1 },
      },
    });
    await this.clearStoredOtp(user.id, 'password-reset', {
      lastPasswordChange: new Date(),
    });
    await this.clearPasswordResetToken(user.id);
    await this.cacheTokenVersion(user.id, updated.tokenVersion as number);
    await this.redis.deleteByPattern(
      `${config.redis_cache_key_prefix}:refresh:${user.id}:*`,
    );

    return { changed: true };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = jwt.verify(
        refreshToken,
        this.refreshSecret,
      ) as AuthenticatedUser;
      const cacheKey = this.refreshTokenKey(payload.userId, refreshToken);
      const cached = await this.redis.get<boolean>(cacheKey);
      if (!cached) {
        throw new UnauthorizedException('Refresh token is invalid');
      }

      const user = await this.mongo.authUser.findUnique({
        where: { id: payload.userId },
        select: { id: true, role: true, status: true, tokenVersion: true },
      });

      if (!user || user.status !== UserStatus.Active) {
        throw new UnauthorizedException('User account is not active');
      }

      if (user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      return this.issueTokens({
        userId: user.id,
        role: user.role as UserRole,
        tokenVersion: user.tokenVersion as number,
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Refresh token is invalid');
    }
  }

  async logout(
    userId: string,
    refreshToken?: string,
  ): Promise<{ loggedOut: true }> {
    if (refreshToken) {
      await this.redis.del(this.refreshTokenKey(userId, refreshToken));
    }
    return { loggedOut: true };
  }

  async logoutAll(userId: string): Promise<{ loggedOut: true }> {
    const user = await this.mongo.authUser.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await this.cacheTokenVersion(userId, user.tokenVersion as number);
    await this.redis.deleteByPattern(
      `${config.redis_cache_key_prefix}:refresh:${userId}:*`,
    );
    return { loggedOut: true };
  }

  async changePassword(
    currentUser: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<{ changed: true }> {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different');
    }

    const user = await this.mongo.authUser.findUnique({
      where: { id: currentUser.userId },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('User not found');
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const password = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    const updated = await this.mongo.authUser.update({
      where: { id: currentUser.userId },
      data: {
        password,
        tokenVersion: { increment: 1 },
      },
    });
    await this.mongo.authSecurity.update({
      where: { authId: currentUser.userId },
      data: { lastPasswordChange: new Date() },
    });
    await this.cacheTokenVersion(
      currentUser.userId,
      updated.tokenVersion as number,
    );
    await this.redis.deleteByPattern(
      `${config.redis_cache_key_prefix}:refresh:${currentUser.userId}:*`,
    );

    return { changed: true };
  }

  async getMe(userId: string): Promise<PublicUser> {
    return this.toPublicUser(await this.findUserWithProfile(userId));
  }

  async buildAuthResponse(user: any): Promise<AuthResponse> {
    const publicUser = this.toPublicUser(user);
    const tokens = await this.issueTokens({
      userId: publicUser.id,
      role: publicUser.role,
      tokenVersion: Number(user.tokenVersion || 0),
    });

    return {
      ...tokens,
      user: publicUser,
    };
  }

  toPublicUser(user: any): PublicUser {
    const profile = user.profile || {};
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      verified: Boolean(user.verified),
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      avatarUrl: profile.avatarUrl || null,
      provider: user.provider,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  assertRoleCanUsePlatform(role: UserRole, platform: ClientPlatform) {
    if (role === UserRole.Field && platform !== ClientPlatform.Mobile) {
      throw new ForbiddenException('Field users can access mobile only');
    }
  }

  private async assertUniqueIdentity(email: string, username: string) {
    const existing = await this.mongo.authUser.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, { username }],
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email or username is already in use');
    }
  }

  private async findByEmail(email: string) {
    return this.mongo.authUser.findFirst({
      where: { email: email.toLowerCase() },
    });
  }

  private async findUserWithProfile(userId: string) {
    const user = await this.mongo.authUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const profile = await this.mongo.userProfile.findFirst({
      where: { authId: userId },
    });

    return {
      ...user,
      profile: profile || {},
    };
  }

  private async issueTokens(payload: AuthenticatedUser): Promise<TokenPair> {
    const accessToken = jwt.sign(payload, config.jwt_access_secret, {
      expiresIn: ACCESS_TOKEN_TTL,
    });
    const refreshToken = jwt.sign(payload, this.refreshSecret, {
      expiresIn: REFRESH_TOKEN_TTL,
    });

    await this.redis.set(
      this.refreshTokenKey(payload.userId, refreshToken),
      true,
      REFRESH_TOKEN_CACHE_SECONDS,
    );
    await this.cacheTokenVersion(payload.userId, payload.tokenVersion);

    return { accessToken, refreshToken };
  }

  private async issuePasswordResetOtp(user: any) {
    await this.assertCanResend(user.authSecurity?.passwordResetOtpLastSentAt);
    const otp = this.generateOtp();
    const otpRecord = await this.createOtpRecord(otp, OTP_TTL_MS);
    await this.mongo.authSecurity.update({
      where: { authId: user.id },
      data: {
        passwordResetOtpHash: otpRecord.hash,
        passwordResetOtpExpiresAt: new Date(otpRecord.expiresAt),
        passwordResetOtpLastSentAt: new Date(),
      },
    });
    await this.storeOtpInRedis(user.id, 'password-reset', otpRecord);
    await this.recordEmail(user.id, user.email, 'password_reset');
    await this.emailQueue.sendPasswordResetEmail(
      user.email,
      user.username,
      otp,
      user.id,
    );
  }

  async issueEmailVerificationOtp(
    userId: string,
    otp: string,
  ): Promise<OtpRecord> {
    const otpRecord = await this.createOtpRecord(otp, VERIFY_EMAIL_OTP_TTL_MS);
    await this.mongo.authSecurity.update({
      where: { authId: userId },
      data: {
        emailVerificationOtpHash: otpRecord.hash,
        emailVerificationOtpExpiresAt: new Date(otpRecord.expiresAt),
        emailVerificationOtpLastSentAt: new Date(),
      },
    });
    await this.storeOtpInRedis(userId, 'email-verification', otpRecord);
    return otpRecord;
  }

  private async assertValidOtpForUser(
    userId: string,
    kind: OtpKind,
    otp: string,
    fallbackHash?: string | null,
    fallbackExpiresAt?: Date | string | null,
  ) {
    const redisOtp = await this.redis.get<OtpRecord>(this.otpKey(userId, kind));

    if (redisOtp) {
      await this.assertValidOtp(
        otp,
        redisOtp.hash,
        redisOtp.expiresAt,
        async () => {
          await this.redis.del(this.otpKey(userId, kind));
        },
      );
      return;
    }

    await this.assertValidOtp(otp, fallbackHash, fallbackExpiresAt);
  }

  private async assertPasswordResetAuthorization(
    user: any,
    dto: ResetPasswordDto,
  ) {
    if (dto.resetToken) {
      await this.assertValidPasswordResetToken(
        user.id,
        dto.resetToken,
        user.authSecurity?.passwordResetTokenHash,
        user.authSecurity?.passwordResetTokenExpiresAt,
      );
      return;
    }

    if (dto.otp) {
      await this.assertValidOtpForUser(
        user.id,
        'password-reset',
        dto.otp,
        user.authSecurity?.passwordResetOtpHash,
        user.authSecurity?.passwordResetOtpExpiresAt,
      );
      return;
    }

    throw new BadRequestException('Reset token or OTP is required');
  }

  private async assertValidPasswordResetToken(
    userId: string,
    token: string,
    fallbackHash?: string | null,
    fallbackExpiresAt?: Date | string | null,
  ) {
    const redisToken = await this.redis.get<ResetTokenRecord>(
      this.passwordResetTokenKey(userId),
    );

    if (redisToken) {
      await this.assertValidHash(
        token,
        redisToken.hash,
        redisToken.expiresAt,
        async () => {
          await this.redis.del(this.passwordResetTokenKey(userId));
        },
      );
      return;
    }

    await this.assertValidHash(token, fallbackHash, fallbackExpiresAt);
  }

  private async assertValidOtp(
    otp: string,
    otpHash?: string | null,
    expiresAt?: Date | string | null,
    onExpired?: () => Promise<void>,
  ) {
    if (!otpHash || !expiresAt || new Date(expiresAt).getTime() < Date.now()) {
      if (onExpired) {
        await onExpired();
      }
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.assertValidHash(otp, otpHash, expiresAt);
  }

  private async assertValidHash(
    value: string,
    hash?: string | null,
    expiresAt?: Date | string | null,
    onExpired?: () => Promise<void>,
  ) {
    if (!hash || !expiresAt || new Date(expiresAt).getTime() < Date.now()) {
      if (onExpired) {
        await onExpired();
      }
      throw new BadRequestException('Invalid or expired OTP');
    }

    const matches = await bcrypt.compare(value, hash);
    if (!matches) {
      throw new BadRequestException('Invalid or expired OTP');
    }
  }

  private async assertCanResend(lastSentAt?: Date | string | null) {
    if (!lastSentAt) {
      return;
    }

    const elapsed = Date.now() - new Date(lastSentAt).getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      throw new BadRequestException(
        'Please wait before requesting another OTP',
      );
    }
  }

  private async recordEmail(authId: string, email: string, emailType: string) {
    await this.mongo.emailHistory.create({
      data: {
        authId,
        emailTo: email,
        emailType,
        subject:
          emailType === 'password_reset'
            ? 'Reset your password'
            : 'Verify your email address',
        messageId: randomUUID(),
        emailStatus: 'pending',
      },
    });
  }

  private generateOtp() {
    return randomInt(100000, 1000000).toString();
  }

  private async createOtpRecord(
    otp: string,
    ttlMs: number,
  ): Promise<OtpRecord> {
    return {
      hash: await bcrypt.hash(otp, BCRYPT_ROUNDS),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    };
  }

  private async storeOtpInRedis(
    userId: string,
    kind: OtpKind,
    record: OtpRecord,
  ) {
    const ttlSeconds = Math.max(
      1,
      Math.ceil((new Date(record.expiresAt).getTime() - Date.now()) / 1000),
    );

    await this.redis.set(this.otpKey(userId, kind), record, ttlSeconds);
  }

  private async clearStoredOtp(
    userId: string,
    kind: OtpKind,
    extraMongoData: Record<string, unknown> = {},
  ) {
    await this.redis.del(this.otpKey(userId, kind));

    const otpFields =
      kind === 'email-verification'
        ? {
            emailVerificationOtpHash: null,
            emailVerificationOtpExpiresAt: null,
          }
        : {
            passwordResetOtpHash: null,
            passwordResetOtpExpiresAt: null,
          };

    await this.mongo.authSecurity.update({
      where: { authId: userId },
      data: {
        ...otpFields,
        ...extraMongoData,
      },
    });
  }

  private async issuePasswordResetToken(
    userId: string,
  ): Promise<{ token: string; expiresIn: number }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
    const record: ResetTokenRecord = {
      hash: await bcrypt.hash(token, BCRYPT_ROUNDS),
      expiresAt: expiresAt.toISOString(),
    };
    const expiresIn = Math.ceil(PASSWORD_RESET_TOKEN_TTL_MS / 1000);

    await this.redis.set(this.passwordResetTokenKey(userId), record, expiresIn);
    await this.mongo.authSecurity.update({
      where: { authId: userId },
      data: {
        passwordResetTokenHash: record.hash,
        passwordResetTokenExpiresAt: expiresAt,
      },
    });

    return { token, expiresIn };
  }

  private async clearPasswordResetToken(userId: string) {
    await this.redis.del(this.passwordResetTokenKey(userId));
    await this.mongo.authSecurity.update({
      where: { authId: userId },
      data: {
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });
  }

  private async recordFailedLogin(userId: string) {
    await this.mongo.authSecurity.update({
      where: { authId: userId },
      data: {
        failedAttempts: { increment: 1 },
        lastFailedAt: new Date(),
      },
    });
  }

  private async resetFailedLogins(userId: string) {
    await this.mongo.authSecurity.update({
      where: { authId: userId },
      data: {
        failedAttempts: 0,
        lockExpiresAt: null,
      },
    });
  }

  private async cacheTokenVersion(userId: string, tokenVersion: number) {
    await this.redis.set(
      `${config.redis_cache_key_prefix}:token_version:${userId}`,
      tokenVersion,
      3600,
    );
  }

  private refreshTokenKey(userId: string, refreshToken: string) {
    return `${config.redis_cache_key_prefix}:refresh:${userId}:${refreshToken}`;
  }

  private otpKey(userId: string, kind: OtpKind) {
    return `${config.redis_cache_key_prefix}:otp:${kind}:${userId}`;
  }

  private passwordResetTokenKey(userId: string) {
    return `${config.redis_cache_key_prefix}:password_reset_token:${userId}`;
  }

  private get refreshSecret() {
    return config.jwt_refresh_secret || config.jwt_access_secret;
  }
}
