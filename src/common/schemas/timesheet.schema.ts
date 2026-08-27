import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TimesheetDocument = HydratedDocument<Timesheet>;
export enum TimesheetStatus { DRAFT = 'DRAFT', SUBMITTED = 'SUBMITTED', APPROVED = 'APPROVED', REJECTED = 'REJECTED' }
export enum TimesheetWorkStatus { WORKING = 'WORKING', OFF_DAY = 'OFF_DAY' }

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
  // New project-based fields. Legacy records retain engineerIds and text job details.
  @Prop({ type: Types.ObjectId, ref: 'Project', default: null }) projectId?: Types.ObjectId | null;
  @Prop({ type: Types.ObjectId, ref: 'Whereabouts', default: null }) assignmentId?: Types.ObjectId | null;
  @Prop({ type: Types.ObjectId, ref: 'TeamMember', default: null }) engineerId?: Types.ObjectId | null;
  @Prop({ enum: Object.values(TimesheetWorkStatus), default: TimesheetWorkStatus.WORKING }) workStatus: TimesheetWorkStatus;
  @Prop({ type: [Types.ObjectId], ref: 'TeamMember', default: [] }) engineerIds: Types.ObjectId[];
  @Prop({ required: false, trim: true, default: '' }) townCity: string;
  @Prop({ required: false, trim: true, uppercase: true, default: '' }) jobNumber: string;
  @Prop({ required: false, trim: true, default: '' }) polygonType: string;
  @Prop({ required: false, trim: true, default: '' }) polygonId: string;
  @Prop({ required: false, trim: true, default: '' }) featureId: string;
  @Prop({ type: [TimesheetItem], default: [] }) items: TimesheetItem[];
  @Prop({ required: true, min: 0, default: 0 }) totalValue: number;
  @Prop({ enum: Object.values(TimesheetStatus), default: TimesheetStatus.DRAFT }) status: TimesheetStatus;
  @Prop({ type: Date, default: null }) submittedAt?: Date | null;
  @Prop({ type: Date, default: null }) reviewedAt?: Date | null;
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', default: null }) reviewedBy?: Types.ObjectId | null;
  @Prop({ type: String, default: null, maxlength: 1000 }) rejectionReason?: string | null;
}

export const TimesheetSchema = SchemaFactory.createForClass(Timesheet);
TimesheetSchema.index({ status: 1, claimDate: -1 });
TimesheetSchema.index({ engineerIds: 1, claimDate: -1 });
TimesheetSchema.index(
  { projectId: 1, assignmentId: 1, engineerId: 1, claimDate: 1 },
  { unique: true, partialFilterExpression: { projectId: { $type: 'objectId' }, assignmentId: { $type: 'objectId' }, engineerId: { $type: 'objectId' } } },
);
TimesheetSchema.index({ projectId: 1, assignmentId: 1, claimDate: -1, status: 1 });
TimesheetSchema.index({ jobNumber: 'text', townCity: 'text', polygonId: 'text', featureId: 'text', 'items.rateCode': 'text' });
