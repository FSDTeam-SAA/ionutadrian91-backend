import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VehicleDocument = HydratedDocument<Vehicle>;

export enum VehicleStatus {
  Moving = 'MOVING',
  Stopped = 'STOPPED',
  Offline = 'OFFLINE',
}

@Schema({ timestamps: true, collection: 'vehicles' })
export class Vehicle {
  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  registrationNumber: string;

  @Prop({ required: true, unique: true, trim: true })
  trackerId: string;

  @Prop({ type: Types.ObjectId, ref: 'TeamMember', default: null })
  assignedEngineerId?: Types.ObjectId | null;

  @Prop({ required: true, enum: Object.values(VehicleStatus), default: VehicleStatus.Offline })
  status: VehicleStatus;

  @Prop({ type: Number, default: null }) latitude?: number | null;
  @Prop({ type: Number, default: null }) longitude?: number | null;
  @Prop({ type: Number, default: 0, min: 0 }) speed: number;
  @Prop({ type: Date, default: null }) lastUpdatedAt?: Date | null;
  @Prop({ type: Boolean, default: true }) isActive: boolean;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);
VehicleSchema.index({ assignedEngineerId: 1 });
VehicleSchema.index({ isActive: 1, status: 1 });
