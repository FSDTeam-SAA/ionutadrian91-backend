import { Module } from '@nestjs/common';
import { QueueModule } from '../../common/modules/queue.module';
import { AuthModule } from '../auth/auth.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
