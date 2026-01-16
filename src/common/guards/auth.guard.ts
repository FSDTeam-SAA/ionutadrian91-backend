import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import config from '../config/app.config';

/**
 * Auth Guard - Validates JWT access tokens (truly stateless)
 *
 * Best Practice: Access tokens are stateless - NO Redis/DB lookup needed
 * - Verified by JWT signature only
 * - Contains minimal payload: { userId, role }
 * - Short-lived (15 min) for security
 * - Refresh token handles revocation
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token found');
    }

    try {
      // Verify JWT signature and expiry (STATELESS - no DB/Redis lookup)
      // This is the ONLY check needed for access tokens
      const payload = jwt.verify(token, config.jwt_access_secret!) as {
        userId: string;
        role: string;
      };

      // Attach user to request for downstream use
      request['user'] = payload;

      return true;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      throw new UnauthorizedException('Authentication failed');
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
