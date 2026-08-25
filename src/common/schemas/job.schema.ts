import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type JobDocument = HydratedDocument<Job>;

export enum JobStatus {
  Pending = 'PENDING',
  Assigned = 'ASSIGNED',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
}

@Schema({ timestamps: true, collection: 'jobs' })
export class Job {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, immutable: true }) projectId: Types.ObjectId;
  @Prop({ required: true, trim: true, uppercase: true }) jobReference: string;
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ required: true, trim: true }) description: string;
  @Prop({ required: true, trim: true }) client: string;
  @Prop({ required: true, trim: true }) location: string;
  @Prop({ type: Types.ObjectId, ref: 'TeamMember', default: null }) assignedEngineerId?: Types.ObjectId | null;
  @Prop({ type: Types.ObjectId, ref: 'TeamMember', default: null }) assignedSupervisorId?: Types.ObjectId | null;
  @Prop({ type: String, default: null, trim: true }) assignedTeamId?: string | null;
  @Prop({ type: Date, required: true }) startDate: Date;
  @Prop({ type: Date, required: true }) expectedCompletionDate: Date;
  @Prop({ required: true, enum: Object.values(JobStatus), default: JobStatus.Pending }) status: JobStatus;
}

export const JobSchema = SchemaFactory.createForClass(Job);
JobSchema.index({ projectId: 1, jobReference: 1 }, { unique: true });
JobSchema.index({ projectId: 1, status: 1, createdAt: -1 });
JobSchema.index({ assignedEngineerId: 1 });
JobSchema.index({ jobReference: 'text', title: 'text', client: 'text', location: 'text' });
