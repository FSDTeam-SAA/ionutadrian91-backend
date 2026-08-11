import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProjectDocument = HydratedDocument<Project>;

export enum ProjectStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

@Schema({ timestamps: true, collection: 'projects' })
export class Project {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ required: true, trim: true })
  clientName: string;

  @Prop({
    required: true,
    enum: Object.values(ProjectStatus),
    default: ProjectStatus.PENDING,
  })
  status: ProjectStatus;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ name: 'text' });
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ createdAt: 1 });
