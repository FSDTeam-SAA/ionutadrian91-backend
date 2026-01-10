/**
 * Authentication-related interfaces and types
 */

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export interface ITokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
