import { Module } from '@nestjs/common';
import { QueueModule } from '../../common/modules/queue.module';
import { RedisModule } from '../../common/modules/redis.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CloudinaryService } from '../../common/services/cloudinary.service';

@Module({
  imports: [QueueModule, RedisModule],
  controllers: [AuthController],
  providers: [AuthService, CloudinaryService],
  exports: [AuthService],
})
export class AuthModule {}
