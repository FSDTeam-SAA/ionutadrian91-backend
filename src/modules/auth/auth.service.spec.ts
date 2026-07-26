import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UserRole, UserStatus } from '../../common/schemas';

describe('AuthService', () => {
  let service: AuthService;
  let mongo: any;
  let redis: any;
  let emailQueue: any;

  beforeEach(() => {
    mongo = {
      authUser: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      authSecurity: {
        create: jest.fn(),
        update: jest.fn(),
      },
      userProfile: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      emailHistory: {
        create: jest.fn(),
      },
    };
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      deleteByPattern: jest.fn(),
    };
    emailQueue = {
      sendVerificationEmail: jest.fn(),
      sendWelcomeEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    service = new AuthService(mongo, redis, emailQueue);
  });

  it('hashes the password and sends verification OTP during registration', async () => {
    mongo.authUser.findFirst.mockResolvedValue(null);
    mongo.authUser.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'user-1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    mongo.userProfile.findFirst.mockResolvedValue({
      firstName: 'Field',
      lastName: 'Operator',
    });
    mongo.authUser.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'field@example.com',
      username: 'field.user',
      role: UserRole.Field,
      status: UserStatus.Active,
      verified: false,
      provider: 'local',
      tokenVersion: 0,
    });

    const result = await service.register({
      email: 'field@example.com',
      username: 'field.user',
      password: 'StrongerPass123!',
      firstName: 'Field',
      lastName: 'Operator',
    });

    const savedPassword = mongo.authUser.create.mock.calls[0][0].data.password;
    expect(savedPassword).not.toBe('StrongerPass123!');
    await expect(
      bcrypt.compare('StrongerPass123!', savedPassword),
    ).resolves.toBe(true);
    expect(emailQueue.sendVerificationEmail).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith(
      'app:otp:email-verification:user-1',
      expect.objectContaining({
        hash: expect.any(String),
        expiresAt: expect.any(String),
      }),
      expect.any(Number),
    );
    expect(result.verificationRequired).toBe(true);
  });

  it('verifies email and removes the OTP from Redis and MongoDB', async () => {
    const otpHash = await bcrypt.hash('123456', 4);
    mongo.authUser.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'field@example.com',
      username: 'field.user',
      role: UserRole.Field,
      status: UserStatus.Active,
      verified: false,
      provider: 'local',
      tokenVersion: 0,
      authSecurity: {
        emailVerificationOtpHash: otpHash,
        emailVerificationOtpExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    redis.get.mockResolvedValue({
      hash: otpHash,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await expect(
      service.verifyEmail({
        email: 'field@example.com',
        otp: '123456',
      }),
    ).resolves.toEqual({ verified: true });

    expect(redis.del).toHaveBeenCalledWith('app:otp:email-verification:user-1');
    expect(mongo.authSecurity.update).toHaveBeenCalledWith({
      where: { authId: 'user-1' },
      data: {
        emailVerificationOtpHash: null,
        emailVerificationOtpExpiresAt: null,
      },
    });
    expect(emailQueue.sendWelcomeEmail).toHaveBeenCalledWith(
      'field@example.com',
      'field.user',
      'user-1',
    );
  });

  it('blocks login before email verification', async () => {
    mongo.authUser.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'field@example.com',
      username: 'field.user',
      password: await bcrypt.hash('StrongerPass123!', 4),
      role: UserRole.Field,
      status: UserStatus.Active,
      verified: false,
      provider: 'local',
      tokenVersion: 0,
    });

    await expect(
      service.login({
        email: 'field@example.com',
        password: 'StrongerPass123!',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses email and password for login lookup', async () => {
    mongo.authUser.findFirst.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'FIELD@example.com',
        password: 'StrongerPass123!',
      }),
    ).rejects.toThrow('Invalid credentials');

    expect(mongo.authUser.findFirst).toHaveBeenCalledWith({
      where: {
        email: 'field@example.com',
      },
    });
  });

  it('returns access and refresh tokens after successful login', async () => {
    mongo.authUser.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'office@example.com',
      username: 'office.user',
      password: await bcrypt.hash('StrongerPass123!', 4),
      role: UserRole.Office,
      status: UserStatus.Active,
      verified: true,
      provider: 'local',
      tokenVersion: 0,
    });
    mongo.authUser.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'office@example.com',
      username: 'office.user',
      role: UserRole.Office,
      status: UserStatus.Active,
      verified: true,
      provider: 'local',
      tokenVersion: 0,
    });
    mongo.userProfile.findFirst.mockResolvedValue({
      firstName: 'Office',
      lastName: 'User',
    });

    const result = await service.login({
      email: 'office@example.com',
      password: 'StrongerPass123!',
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).toMatchObject({
      id: 'user-1',
      email: 'office@example.com',
      role: UserRole.Office,
    });
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('app:refresh:user-1:'),
      true,
      expect.any(Number),
    );
  });

  it('resets password with OTP, hashes it, and revokes existing tokens', async () => {
    const otpHash = await bcrypt.hash('123456', 4);
    const oldPasswordHash = await bcrypt.hash('OldPass123!', 4);
    mongo.authUser.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'field@example.com',
      username: 'field.user',
      password: oldPasswordHash,
      role: UserRole.Field,
      status: UserStatus.Active,
      verified: true,
      provider: 'local',
      tokenVersion: 0,
      authSecurity: {
        passwordResetOtpHash: otpHash,
        passwordResetOtpExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    mongo.authUser.update.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'user-1',
        tokenVersion: 1,
        password: data.password,
      }),
    );

    await service.resetPassword({
      email: 'field@example.com',
      otp: '123456',
      newPassword: 'NewPass123!',
    });

    const savedPassword = mongo.authUser.update.mock.calls[0][0].data.password;
    expect(savedPassword).not.toBe('NewPass123!');
    await expect(bcrypt.compare('NewPass123!', savedPassword)).resolves.toBe(
      true,
    );
    expect(mongo.authUser.update.mock.calls[0][0].data.tokenVersion).toEqual({
      increment: 1,
    });
    expect(redis.deleteByPattern).toHaveBeenCalledWith('app:refresh:user-1:*');
  });

  it('does not reveal missing accounts in forgot password', async () => {
    mongo.authUser.findFirst.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ email: 'missing@example.com' }),
    ).resolves.toEqual({ otpSentIfAccountExists: true });
    expect(emailQueue.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
