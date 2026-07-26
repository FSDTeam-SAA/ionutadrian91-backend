import { Module, Global } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { THROTTLER_CONFIG } from '../config/throttler.config';
import { buildRedisOptions } from '../config/redis.config';
import { CustomThrottlerGuard } from '../guards/custom-throttler.guard';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService, logger: Logger) => {
        const redisClient = new Redis({
          ...buildRedisOptions(configService),
          keyPrefix: `${configService.get<string>('REDIS_CACHE_KEY_PREFIX', 'app')}:throttle:`,
        });

        redisClient.on('error', (error) => {
          logger.error(`Redis throttler connection error: ${error.message}`, {
            context: 'RateLimitModule',
            error: error.message,
          });
        });

        return {
          throttlers: [
            {
              name: 'default',
              ttl: THROTTLER_CONFIG.DEFAULT.ttl,
              limit: THROTTLER_CONFIG.DEFAULT.limit,
            },
            {
              name: 'strict',
              ttl: THROTTLER_CONFIG.STRICT.ttl,
              limit: THROTTLER_CONFIG.STRICT.limit,
            },
            {
              name: 'auth',
              ttl: THROTTLER_CONFIG.AUTH.ttl,
              limit: THROTTLER_CONFIG.AUTH.limit,
            },
            {
              name: 'relaxed',
              ttl: THROTTLER_CONFIG.RELAXED.ttl,
              limit: THROTTLER_CONFIG.RELAXED.limit,
            },
          ],
          storage: new ThrottlerStorageRedisService(redisClient),
        };
      },
      inject: [ConfigService, WINSTON_MODULE_PROVIDER],
    }),
  ],
  providers: [
    // Apply custom rate limiting globally to all routes
    // This guard skips Swagger, metrics, and other infrastructure endpoints
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
