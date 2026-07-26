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
  EmailHistory,
  EmailHistorySchema,
  LoginHistory,
  LoginHistorySchema,
  UserProfile,
  UserProfileSchema,
} from '../schemas';

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(
      config.mongodb_uri,
    ),
    MongooseModule.forFeature([
      { name: AuthUser.name, schema: AuthUserSchema },
      { name: AuthSecurity.name, schema: AuthSecuritySchema },
      { name: EmailHistory.name, schema: EmailHistorySchema },
      { name: LoginHistory.name, schema: LoginHistorySchema },
      { name: ActivityLogEvent.name, schema: ActivityLogEventSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
  ],
  providers: [MongoService],
  exports: [MongoService, MongooseModule],
})
export class MongoModule {}
