import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler/dist/throttler-module-options.interface';
import type { ThrottlerLimitDetail } from '@nestjs/throttler/dist/throttler.guard.interface';
import type { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';

/**
 * Custom Throttler Guard that skips rate limiting for:
 * - Scalar/OpenAPI endpoints (/api-docs, /api-docs/openapi.json, etc.)
 * - Metrics endpoints (/metrics)
 * - Health check endpoints
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    protected readonly options: ThrottlerModuleOptions,
    protected readonly storageService: ThrottlerStorage,
    protected readonly reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected generateKey(
    context: ExecutionContext,
    tracker: string,
    throttlerName: string,
  ): string {
    const trackerHash = createHash('sha256').update(tracker).digest('hex');
    return [
      context.getClass().name,
      context.getHandler().name,
      throttlerName,
      trackerHash,
    ].join(':');
  }

  protected throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<{ url: string }>();
    const retryAfter = Math.max(
      1,
      detail.timeToBlockExpire || detail.timeToExpire,
    );
    const path = request.url;

    return Promise.reject(
      new HttpException(
        {
          success: false,
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: this.getRateLimitMessage(path, retryAfter),
          error: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
          details: {
            limit: detail.limit,
            remaining: 0,
            resetIn: retryAfter,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (this.isRateLimitDisabled()) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ url: string }>();
    const path = request.url;

    // Skip throttling for Scalar/OpenAPI documentation
    if (
      path.startsWith('/api-docs') ||
      path.startsWith('/api-json') ||
      path.includes('-json')
    ) {
      return true;
    }

    // Skip throttling for metrics endpoints (Prometheus)
    if (path.startsWith('/metrics')) {
      return true;
    }

    // Skip throttling for favicon
    if (path === '/favicon.ico') {
      return true;
    }

    // Check if route has @SkipThrottle decorator
    return super.shouldSkip(context);
  }

  private isRateLimitDisabled(): boolean {
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return true;
    }

    return (
      process.env.RATE_LIMIT_ENABLED === undefined &&
      process.env.NODE_ENV !== 'production'
    );
  }

  private getRateLimitMessage(path: string, retryAfterSeconds: number): string {
    const waitText = this.formatRetryAfter(retryAfterSeconds);

    if (path.startsWith('/auth/register')) {
      return `Too many registration attempts. Please wait ${waitText} before creating another account.`;
    }

    if (path.startsWith('/auth/login')) {
      return `Too many login attempts. Please wait ${waitText} before trying again.`;
    }

    if (
      path.startsWith('/auth/forgot-password') ||
      path.startsWith('/auth/resend-otp') ||
      path.startsWith('/auth/change-password')
    ) {
      return `Too many password or OTP requests. Please wait ${waitText} before trying again.`;
    }

    return `Too many requests. Please wait ${waitText} before trying again.`;
  }

  private formatRetryAfter(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} second${seconds === 1 ? '' : 's'}`;
    }

    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
}
