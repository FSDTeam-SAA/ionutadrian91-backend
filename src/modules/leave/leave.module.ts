import { Module } from '@nestjs/common';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { CloudinaryService } from '../../common/services/cloudinary.service';

@Module({
  controllers: [LeaveController],
  providers: [LeaveService, CloudinaryService],
})
export class LeaveModule {}
