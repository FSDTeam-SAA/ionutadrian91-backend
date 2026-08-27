import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TimesheetUnlockRequestDocument = HydratedDocument<TimesheetUnlockRequest>;
export enum TimesheetUnlockRequestStatus { PENDING = 'PENDING', APPROVED = 'APPROVED', REJECTED = 'REJECTED' }

@Schema({ timestamps: true, collection: 'timesheet_unlock_requests' })
export class TimesheetUnlockRequest {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Project' }) projectId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, ref: 'Whereabouts' }) assignmentId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, ref: 'TeamMember' }) engineerId: Types.ObjectId;
  @Prop({ type: Date, required: true }) claimDate: Date;
  @Prop({ enum: Object.values(TimesheetUnlockRequestStatus), default: TimesheetUnlockRequestStatus.PENDING }) status: TimesheetUnlockRequestStatus;
  @Prop({ type: String, trim: true, maxlength: 500, default: null }) reason?: string | null;
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', default: null }) reviewedBy?: Types.ObjectId | null;
  @Prop({ type: Date, default: null }) reviewedAt?: Date | null;
}

export const TimesheetUnlockRequestSchema = SchemaFactory.createForClass(TimesheetUnlockRequest);
TimesheetUnlockRequestSchema.index({ projectId: 1, assignmentId: 1, engineerId: 1, claimDate: 1, status: 1 });
