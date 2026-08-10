import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type HrPlanDocument = HydratedDocument<HrPlan>;

export enum HrPlanStatus {
  Draft = 'DRAFT',
  Active = 'ACTIVE',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
}

@Schema({ timestamps: true, collection: 'hr_plans' })
export class HrPlan {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true, default: '' })
  description: string;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Department' })
  departmentId: Types.ObjectId;

  @Prop({
    required: true,
    default: HrPlanStatus.Draft,
    enum: Object.values(HrPlanStatus),
  })
  status: HrPlanStatus;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: Types.ObjectId, required: true, ref: 'AuthUser' })
  createdById: Types.ObjectId;
}

export const HrPlanSchema = SchemaFactory.createForClass(HrPlan);
HrPlanSchema.index({ departmentId: 1, startDate: 1 });
HrPlanSchema.index({ status: 1 });
