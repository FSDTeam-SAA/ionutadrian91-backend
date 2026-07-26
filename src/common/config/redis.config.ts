import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export function buildRedisOptions(
  configService: ConfigService,
  overrides: RedisOptions = {},
): RedisOptions {
  const username = configService.get<string>('REDIS_USER')?.trim();
  const password = configService.get<string>('REDIS_PASSWORD')?.trim();
  const useTls = configService.get<string>('REDIS_TLS') === 'true';

  return {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: Number(configService.get<number | string>('REDIS_PORT', 6379)),
    db: Number(configService.get<number | string>('REDIS_DB', 0)),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(useTls
      ? {
          tls: {
            rejectUnauthorized:
              configService.get<string>('REDIS_TLS_REJECT_UNAUTHORIZED') !==
              'false',
          },
        }
      : {}),
    enableReadyCheck: true,
    enableOfflineQueue: true,
    connectTimeout: 10000,
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 10) {
        return null;
      }

      return Math.min(times * 100, 3000);
    },
    reconnectOnError: (err: Error) =>
      ['READONLY', 'ECONNRESET', 'ETIMEDOUT'].some((target) =>
        err.message.includes(target),
      ),
    ...overrides,
  };
}
