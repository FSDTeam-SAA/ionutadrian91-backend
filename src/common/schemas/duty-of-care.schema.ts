import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DutyOfCareDocument = HydratedDocument<DutyOfCare>;

@Schema({ timestamps: true, collection: 'duty_of_care' })
export class DutyOfCare {
  @Prop({ type: Types.ObjectId, required: true, ref: 'TeamMember' })
  teamMemberId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: false, ref: 'Project' })
  projectId?: Types.ObjectId;

  @Prop({ type: Date, required: true })
  startTime: Date;

  @Prop({ type: Date, default: null })
  endTime?: Date;

  @Prop({ type: String, default: '' })
  notes: string;
}

export const DutyOfCareSchema = SchemaFactory.createForClass(DutyOfCare);
DutyOfCareSchema.index({ teamMemberId: 1 });
DutyOfCareSchema.index({ projectId: 1 });
DutyOfCareSchema.index({ startTime: 1, endTime: 1 });
