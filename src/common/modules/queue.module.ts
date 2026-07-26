import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import config from '../config/app.config';
import { buildRedisOptions } from '../config/redis.config';
import { EmailService } from '../services/email.service';
import { EmailQueueService } from '../queues/email/email.queue';
import { EmailProcessor } from '../queues/email/email.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService, logger: Logger) => {
        const connection = new Redis(buildRedisOptions(configService, {
          maxRetriesPerRequest: null,
        }));

        connection.on('error', (error) => {
          logger.error(`Redis BullMQ connection error: ${error.message}`, {
            context: 'QueueModule',
            error: error.message,
          });
        });

        return {
          connection,
          prefix: `${config.redis_cache_key_prefix}:bull`,
        };
      },
      inject: [ConfigService, WINSTON_MODULE_PROVIDER],
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  providers: [EmailQueueService, EmailProcessor, EmailService],
  exports: [EmailQueueService],
})
export class QueueModule {}
