import type { Request } from 'express';
import { UserRole, UserStatus } from '../../../common/schemas';

export enum ClientPlatform {
  Web = 'web',
  Desktop = 'desktop',
  Mobile = 'mobile',
}

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  tokenVersion: number;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  verified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  provider: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends TokenPair {
  user: PublicUser;
}
