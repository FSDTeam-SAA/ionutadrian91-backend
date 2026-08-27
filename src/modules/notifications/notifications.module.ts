import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeaveRequest, LeaveRequestSchema, RiskAssessment, RiskAssessmentSchema, Timesheet, TimesheetSchema, TimesheetUnlockRequest, TimesheetUnlockRequestSchema } from '../../common/schemas';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LeaveRequest.name, schema: LeaveRequestSchema },
      { name: RiskAssessment.name, schema: RiskAssessmentSchema },
      { name: Timesheet.name, schema: TimesheetSchema },
      { name: TimesheetUnlockRequest.name, schema: TimesheetUnlockRequestSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
