import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import config from '../config/app.config';
import { MongoService } from '../services/mongo.service';
import {
  ActivityLogEvent,
  ActivityLogEventSchema,
  AuthSecurity,
  AuthSecuritySchema,
  AuthUser,
  AuthUserSchema,
  Department,
  DepartmentSchema,
  EmailHistory,
  EmailHistorySchema,
  LoginHistory,
  LoginHistorySchema,
  HrPlan,
  HrPlanSchema,
  TeamMember,
  TeamMemberSchema,
  UserProfile,
  UserProfileSchema,
} from '../schemas';

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(config.mongodb_uri),
    MongooseModule.forFeature([
      { name: AuthUser.name, schema: AuthUserSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: AuthSecurity.name, schema: AuthSecuritySchema },
      { name: EmailHistory.name, schema: EmailHistorySchema },
      { name: LoginHistory.name, schema: LoginHistorySchema },
      { name: HrPlan.name, schema: HrPlanSchema },
      { name: TeamMember.name, schema: TeamMemberSchema },
      { name: ActivityLogEvent.name, schema: ActivityLogEventSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
  ],
  providers: [MongoService],
  exports: [MongoService, MongooseModule],
})
export class MongoModule {}
