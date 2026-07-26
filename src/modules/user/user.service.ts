import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { MongoService } from '../../common/services/mongo.service';
import { EmailQueueService } from '../../common/queues/email/email.queue';
import { UserRole, UserStatus } from '../../common/schemas';
import { AuthService } from '../auth/auth.service';
import { PublicUser } from '../auth/interfaces/auth.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;
const VERIFY_EMAIL_OTP_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class UserService {
  constructor(
    private readonly mongo: MongoService,
    private readonly emailQueue: EmailQueueService,
    private readonly authService: AuthService,
  ) {}

  async create(dto: CreateUserDto): Promise<PublicUser> {
    await this.assertUniqueIdentity(dto.email, dto.username);

    const otp = this.generateOtp();
    const user = await this.mongo.authUser.create({
      data: {
        email: dto.email.toLowerCase(),
        username: dto.username,
        password: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: dto.role,
        status: UserStatus.Active,
        verified: false,
        provider: 'local',
        tokenVersion: 0,
      },
    });

    await this.mongo.authSecurity.create({
      data: {
        authId: user.id,
        failedAttempts: 0,
        mfaEnabled: false,
        lastPasswordChange: new Date(),
        emailVerificationOtpHash: await bcrypt.hash(otp, BCRYPT_ROUNDS),
        emailVerificationOtpExpiresAt: new Date(
          Date.now() + VERIFY_EMAIL_OTP_TTL_MS,
        ),
        emailVerificationOtpLastSentAt: new Date(),
      },
    });
    await this.mongo.userProfile.create({
      data: {
        authId: user.id,
        firstName: dto.firstName || '',
        lastName: dto.lastName || '',
      },
    });
    await this.emailQueue.sendVerificationEmail(
      user.email,
      user.username,
      otp,
      user.id,
    );

    return this.findOne(user.id);
  }

  async findAll(query: ListUsersDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const where: Record<string, unknown> = {};

    if (query.role) {
      where.role = query.role;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { email: new RegExp(query.search, 'i') },
        { username: new RegExp(query.search, 'i') },
      ];
    }

    const [users, total] = await Promise.all([
      this.mongo.authUser.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.mongo.authUser.count({ where }),
    ]);

    return {
      items: await Promise.all(users.map((user) => this.attachProfile(user))),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.mongo.authUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.attachProfile(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const existing = await this.mongo.authUser.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (existing.role === UserRole.Administrator && dto.status === UserStatus.Inactive) {
      const activeAdmins = await this.mongo.authUser.count({
        where: { role: UserRole.Administrator, status: UserStatus.Active },
      });
      if (activeAdmins <= 1) {
        throw new BadRequestException('At least one active administrator is required');
      }
    }

    const authUpdates: Record<string, unknown> = {};
    if (dto.role) {
      authUpdates.role = dto.role;
    }
    if (dto.status) {
      authUpdates.status = dto.status;
    }

    if (Object.keys(authUpdates).length > 0) {
      await this.mongo.authUser.update({
        where: { id },
        data: authUpdates,
      });
    }

    await this.updateProfile(id, dto);
    return this.findOne(id);
  }

  async updateOwnProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    await this.updateProfile(id, dto);
    return this.findOne(id);
  }

  async deactivate(id: string): Promise<{ deactivated: true }> {
    await this.update(id, { status: UserStatus.Inactive });
    return { deactivated: true };
  }

  private async attachProfile(user: any): Promise<PublicUser> {
    const profile = await this.mongo.userProfile.findFirst({
      where: { authId: user.id },
    });

    return this.authService.toPublicUser({
      ...user,
      profile: profile || {},
    });
  }

  private async updateProfile(id: string, dto: UpdateProfileDto) {
    const profile = await this.mongo.userProfile.findFirst({ where: { authId: id } });
    const data = {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
    };

    if (Object.keys(data).length === 0) {
      return;
    }

    if (profile) {
      await this.mongo.userProfile.update({
        where: { authId: id },
        data,
      });
    } else {
      await this.mongo.userProfile.create({
        data: {
          authId: id,
          ...data,
        },
      });
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

  private generateOtp() {
    return randomInt(100000, 1000000).toString();
  }
}
