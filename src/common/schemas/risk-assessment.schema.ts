import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
export type RiskAssessmentDocument = HydratedDocument<RiskAssessment>;
export enum RiskAssessmentStatus {
  Draft = 'DRAFT',
  Submitted = 'SUBMITTED',
  Reviewed = 'REVIEWED',
}
@Schema({ timestamps: true, collection: 'risk_assessments' })
export class RiskAssessment {
  @Prop({ required: true, unique: true }) assessmentNumber: string;
  @Prop({ type: Types.ObjectId, ref: 'TeamMember', required: true })
  engineerId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Whereabouts', required: true })
  assignmentId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Job', default: null })
  jobId?: Types.ObjectId | null;
  @Prop({ type: Types.Map, of: String, default: {} })
  answers: Map<string, string>;
  @Prop({ type: [String], default: [] }) photoUrls: string[];
  @Prop({ type: String, default: null }) signatureUrl?: string | null;
  @Prop({ type: Boolean, default: false }) engineerConfirmed: boolean;
  @Prop({
    type: {
      latitude: { type: Number, required: false },
      longitude: { type: Number, required: false },
    },
    default: null,
  })
  location?: { latitude: number; longitude: number } | null;
  @Prop({ type: String, default: null }) adminNote?: string | null;
  @Prop({ type: Boolean, default: false }) adminDangerFlag?: boolean;
  @Prop({
    enum: Object.values(RiskAssessmentStatus),
    default: RiskAssessmentStatus.Draft,
  })
  status: RiskAssessmentStatus;
  @Prop({ type: Date, default: null }) submittedAt?: Date | null;
}
export const RiskAssessmentSchema =
  SchemaFactory.createForClass(RiskAssessment);
RiskAssessmentSchema.index({ engineerId: 1, createdAt: -1 });
RiskAssessmentSchema.index({ projectId: 1, assignmentId: 1, status: 1 });
