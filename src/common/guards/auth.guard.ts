import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import config from '../config/app.config';
import { RedisService } from '../services/redis.service';

/**
 * Auth Guard - Validates JWT tokens with blacklist check
 * Best Practice: Stateless JWT + Redis blacklist for logout
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token found');
    }

    try {
      // Verify JWT signature and expiry (STATELESS - no DB lookup)
      const payload = jwt.verify(token, config.jwt_access_secret!) as {
        userId: string;
        email: string;
        role: string;
      };

      // Check if token is blacklisted (only for explicit logout)
      // This is the ONLY Redis check - much faster than storing all tokens
      const blacklistKey = `${config.redis_cache_key_prefix}:token_blacklist:${token}`;
      const isBlacklisted = await this.redisService.exists(blacklistKey);

      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      // Attach user to request for downstream use
      request['user'] = payload;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Extract token from Authorization header
   * Format: Bearer <token>
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  /**
   * Extract token from cookies (alternative method)
   */
  private extractTokenFromCookies(request: Request): string | undefined {
    return request.cookies?.['accessToken'];
  }
}
