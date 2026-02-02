import { Module } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { PrismaService } from '../common/services/prisma.service';
import { ActivityLogService } from '../common/services/activity-log.service';
import { RedisService } from '../common/services/redis.service';

@Module({
  controllers: [JobController],
  providers: [JobService, PrismaService, ActivityLogService, RedisService],
  exports: [JobService],
})
export class JobModule {}
