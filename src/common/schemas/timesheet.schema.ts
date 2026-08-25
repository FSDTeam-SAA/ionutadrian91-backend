import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TimesheetDocument = HydratedDocument<Timesheet>;
export enum TimesheetStatus { DRAFT = 'DRAFT', SUBMITTED = 'SUBMITTED', APPROVED = 'APPROVED', REJECTED = 'REJECTED' }

export class TimesheetItem {
  @Prop({ required: true }) rateCode: string;
  @Prop({ required: true }) description: string;
  @Prop({ required: true }) unit: string;
  @Prop({ required: true, min: 0 }) unitPrice: number;
  @Prop({ required: true, min: 0 }) quantity: number;
  @Prop({ required: true, min: 0 }) total: number;
  @Prop({ type: String, default: null }) buildStatus?: string | null;
  @Prop({ type: String, default: null }) comments?: string | null;
}

@Schema({ timestamps: true, collection: 'timesheets' })
export class Timesheet {
  @Prop({ type: Date, required: true }) claimDate: Date;
  @Prop({ type: [Types.ObjectId], ref: 'TeamMember', required: true }) engineerIds: Types.ObjectId[];
  @Prop({ required: true, trim: true }) townCity: string;
  @Prop({ required: true, trim: true, uppercase: true }) jobNumber: string;
  @Prop({ required: true, trim: true }) polygonType: string;
  @Prop({ required: true, trim: true }) polygonId: string;
  @Prop({ required: true, trim: true }) featureId: string;
  @Prop({ type: [TimesheetItem], required: true }) items: TimesheetItem[];
  @Prop({ required: true, min: 0 }) totalValue: number;
  @Prop({ enum: Object.values(TimesheetStatus), default: TimesheetStatus.DRAFT }) status: TimesheetStatus;
  @Prop({ type: Date, default: null }) submittedAt?: Date | null;
  @Prop({ type: Date, default: null }) reviewedAt?: Date | null;
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', default: null }) reviewedBy?: Types.ObjectId | null;
  @Prop({ type: String, default: null, maxlength: 1000 }) rejectionReason?: string | null;
}

export const TimesheetSchema = SchemaFactory.createForClass(Timesheet);
TimesheetSchema.index({ status: 1, claimDate: -1 });
TimesheetSchema.index({ engineerIds: 1, claimDate: -1 });
TimesheetSchema.index({ jobNumber: 'text', townCity: 'text', polygonId: 'text', featureId: 'text', 'items.rateCode': 'text' });
