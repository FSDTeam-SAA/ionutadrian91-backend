/**
 * Authentication Configuration Constants
 */

export const AUTH_CONFIG = {
  // Password Configuration
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIREMENTS: {
    UPPERCASE: true,
    LOWERCASE: true,
    NUMBERS: true,
    SPECIAL_CHARS: true,
  },

  // Token Configuration
  TOKEN_EXPIRY: {
    ACCESS: '1h',
    REFRESH: '7d',
    VERIFICATION: '24h',
    PASSWORD_RESET: '1h',
  },

  // Rate Limiting
  RATE_LIMIT: {
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    PASSWORD_RESET_MAX_ATTEMPTS: 3,
    PASSWORD_RESET_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  },

  // Account Lockout
  ACCOUNT_LOCKOUT: {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  },

  // Role Hierarchy (higher number = more permissions)
  ROLE_HIERARCHY: {
    CUSTOMER: 1,
    MODERATOR: 2,
    ADMIN: 3,
    SUPER_ADMIN: 4,
  },

  // Cache Prefixes
  CACHE_PREFIXES: {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    RATE_LIMIT: 'rate_limit:',
    VERIFICATION_TOKEN: 'verification_token',
    PASSWORD_RESET_TOKEN: 'password_reset_token',
  },
} as const;
