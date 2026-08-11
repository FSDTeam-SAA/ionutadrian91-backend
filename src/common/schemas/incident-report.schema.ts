import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IncidentReportDocument = HydratedDocument<IncidentReport>;

export enum IncidentStatus {
  NEW = 'NEW',
  INVESTIGATING = 'INVESTIGATING',
  CLOSED = 'CLOSED',
}

@Schema({ timestamps: true, collection: 'incident_reports' })
export class IncidentReport {
  @Prop({ type: Types.ObjectId, required: true, ref: 'TeamMember' })
  teamMemberId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Project' })
  projectId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ required: true, trim: true })
  details: string;

  @Prop({
    type: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    required: true,
  })
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };

  @Prop({ type: String, default: null })
  photoUrl?: string | null;

  @Prop({ type: String, select: false, default: null })
  photoPublicId?: string | null;

  @Prop({
    required: true,
    enum: Object.values(IncidentStatus),
    default: IncidentStatus.NEW,
  })
  status: IncidentStatus;

  // Admin fields
  @Prop({ type: String, default: '' })
  investigationDetails?: string;

  @Prop({ type: String, default: '' })
  rootCause?: string;
}

export const IncidentReportSchema = SchemaFactory.createForClass(IncidentReport);
IncidentReportSchema.index({ status: 1 });
IncidentReportSchema.index({ date: 1 });
IncidentReportSchema.index({ projectId: 1 });
