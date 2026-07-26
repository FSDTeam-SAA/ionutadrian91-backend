import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EmailHistoryDocument = HydratedDocument<EmailHistory>;

@Schema({ timestamps: true, collection: 'email_history' })
export class EmailHistory {
  @Prop({ type: Types.ObjectId, required: true, ref: 'AuthUser' })
  authId: Types.ObjectId;

  @Prop({ required: true })
  emailTo: string;

  @Prop({ required: true })
  emailType: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  messageId: string;

  @Prop({ required: true, default: 'pending' })
  emailStatus: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  errorMessage?: string;
}

export const EmailHistorySchema = SchemaFactory.createForClass(EmailHistory);

EmailHistorySchema.index({ authId: 1, emailType: 1, emailStatus: 1 });
