import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DepartmentDocument = HydratedDocument<Department>;

@Schema({ timestamps: true, collection: 'departments' })
export class Department {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, required: true, ref: 'AuthUser' })
  headId: Types.ObjectId;

  @Prop({ required: true, trim: true, default: '' })
  description: string;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
DepartmentSchema.index({ headId: 1 });
