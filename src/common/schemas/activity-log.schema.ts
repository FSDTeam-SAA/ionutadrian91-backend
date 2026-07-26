import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ActivityLogEventDocument = HydratedDocument<ActivityLogEvent>;

@Schema({ _id: false })
export class ActivityLogDetail {
  @Prop({ required: true })
  fieldName: string;

  @Prop({ type: String, default: null })
  oldValue: string | null;

  @Prop({ type: String, default: null })
  newValue: string | null;
}

const ActivityLogDetailSchema = SchemaFactory.createForClass(ActivityLogDetail);

@Schema({ timestamps: true, collection: 'activity_log_events' })
export class ActivityLogEvent {
  @Prop({ required: true })
  tableName: string;

  @Prop({ required: true })
  recordId: string;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ type: String, default: null })
  actionedBy?: string | null;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  device?: string;

  @Prop({ type: [ActivityLogDetailSchema], default: [] })
  details: ActivityLogDetail[];
}

export const ActivityLogEventSchema =
  SchemaFactory.createForClass(ActivityLogEvent);
