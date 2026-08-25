import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VehicleStatus } from './vehicle.schema';

export type VehicleLocationHistoryDocument = HydratedDocument<VehicleLocationHistory>;

@Schema({ timestamps: false, collection: 'vehicle_location_history' })
export class VehicleLocationHistory {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Vehicle', index: true }) vehicleId: Types.ObjectId;
  @Prop({ required: true }) latitude: number;
  @Prop({ required: true }) longitude: number;
  @Prop({ required: true, min: 0 }) speed: number;
  @Prop({ type: String, required: true, enum: Object.values(VehicleStatus) }) status: VehicleStatus;
  @Prop({ required: true, default: Date.now, index: true }) timestamp: Date;
}

export const VehicleLocationHistorySchema = SchemaFactory.createForClass(VehicleLocationHistory);
VehicleLocationHistorySchema.index({ vehicleId: 1, timestamp: -1 });
