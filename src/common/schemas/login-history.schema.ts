import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LoginHistoryDocument = HydratedDocument<LoginHistory>;

@Schema({ timestamps: true, collection: 'login_history' })
export class LoginHistory {
  @Prop({ type: Types.ObjectId, required: true, ref: 'AuthUser' })
  authId: Types.ObjectId;

  @Prop({ required: true })
  ipAddress: string;

  @Prop({ required: true })
  userAgent: string;

  @Prop()
  device_id?: string;

  @Prop({ required: true, default: 'login' })
  action: string;

  @Prop({ required: true })
  success: boolean;

  @Prop()
  failureReason?: string;

  @Prop({ required: true, default: 1 })
  attemptNumber: number;

  @Prop({ required: true, default: false })
  isSuspicious: boolean;
}

export const LoginHistorySchema = SchemaFactory.createForClass(LoginHistory);
