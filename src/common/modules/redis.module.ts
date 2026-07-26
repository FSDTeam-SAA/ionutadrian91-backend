import { Module, Global, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Redis as RedisType } from 'ioredis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { buildRedisOptions } from '../config/redis.config';
import { RedisService } from '../services/redis.service';
import { REDIS_CLIENT } from '../constants/redis.constants';

const createRedisClient = (
  configService: ConfigService,
  logger: Logger,
): RedisType => {
  const client = new Redis(
    buildRedisOptions(configService, {
      retryStrategy: (times: number) => {
        if (times > 10) {
          logger.error('Redis max connection retries reached. Stopping...', {
          context: 'RedisModule',
        });
        return null;
      }
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`, {
        context: 'RedisModule',
        attempt: times,
        delay,
        });
        return delay;
      },
    }),
  );

  // Event listeners for monitoring
  client.on('error', (err) =>
    logger.error(`Redis error: ${err.message}`, {
      context: 'RedisModule',
      error: err.message,
    }),
  );
  client.on('connect', () =>
    logger.info('Redis connecting...', { context: 'RedisModule' }),
  );
  client.on('ready', () =>
    logger.info('Redis ready', { context: 'RedisModule' }),
  );
  client.on('close', () =>
    logger.warn('Redis connection closed', { context: 'RedisModule' }),
  );
  client.on('reconnecting', () =>
    logger.warn('Redis reconnecting...', { context: 'RedisModule' }),
  );

  return client;
};

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: createRedisClient,
      inject: [ConfigService, WINSTON_MODULE_PROVIDER],
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: RedisType,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      this.logger.info('Closing Redis connection...', {
        context: 'RedisModule',
      });
      await this.client.quit();
      this.logger.info('Redis connection closed', { context: 'RedisModule' });
    }
  }
}
