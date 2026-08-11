import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LeaveRequestDocument = HydratedDocument<LeaveRequest>;

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Schema({ timestamps: true, collection: 'leave_requests' })
export class LeaveRequest {
  @Prop({ required: true, unique: true })
  requestId: string;

  @Prop({ type: Types.ObjectId, required: true, ref: 'TeamMember' })
  teamMemberId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({
    required: true,
    enum: Object.values(LeaveStatus),
    default: LeaveStatus.PENDING,
  })
  status: LeaveStatus;

  @Prop({ type: String, default: null })
  documentUrl?: string | null;

  @Prop({ type: String, select: false, default: null })
  documentPublicId?: string | null;
}

export const LeaveRequestSchema = SchemaFactory.createForClass(LeaveRequest);
LeaveRequestSchema.index({ teamMemberId: 1 });
LeaveRequestSchema.index({ status: 1 });
LeaveRequestSchema.index({ startDate: 1, endDate: 1 });
