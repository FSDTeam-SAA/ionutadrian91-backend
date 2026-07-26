import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerLimitDetail } from '@nestjs/throttler/dist/throttler.guard.interface';
import type { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';
import { CustomThrottlerGuard } from './custom-throttler.guard';

class TestThrottlerGuard extends CustomThrottlerGuard {
  shouldSkipForTest(context: ExecutionContext): Promise<boolean> {
    return this.shouldSkip(context);
  }

  throwForTest(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    return this.throwThrottlingException(context, detail);
  }
}

describe('CustomThrottlerGuard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('skips throttling for every route in development', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.RATE_LIMIT_ENABLED;

    const storage: ThrottlerStorage = {
      increment: jest.fn(),
    };
    const guard = new TestThrottlerGuard(
      { throttlers: [] },
      storage,
      new Reflector(),
    );
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/auth/register' }),
      }),
    } as ExecutionContext;

    await expect(guard.shouldSkipForTest(context)).resolves.toBe(true);
  });

  it('throws a user-friendly registration rate-limit response', async () => {
    const storage: ThrottlerStorage = {
      increment: jest.fn(),
    };
    const guard = new TestThrottlerGuard(
      { throttlers: [] },
      storage,
      new Reflector(),
    );
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/auth/register' }),
      }),
    } as ExecutionContext;

    await expect(
      guard.throwForTest(context, {
        limit: 10,
        ttl: 60,
        key: 'registration-key',
        tracker: '127.0.0.1',
        totalHits: 11,
        timeToExpire: 48,
        isBlocked: true,
        timeToBlockExpire: 48,
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    try {
      await guard.throwForTest(context, {
        limit: 10,
        ttl: 60,
        key: 'registration-key',
        tracker: '127.0.0.1',
        totalHits: 11,
        timeToExpire: 48,
        isBlocked: true,
        timeToBlockExpire: 48,
      });
    } catch (error) {
      const response = (error as HttpException).getResponse();

      expect(response).toEqual({
        success: false,
        statusCode: 429,
        message:
          'Too many registration attempts. Please wait 48 seconds before creating another account.',
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 48,
        details: {
          limit: 10,
          remaining: 0,
          resetIn: 48,
        },
      });
    }
  });
});
