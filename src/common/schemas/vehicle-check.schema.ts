import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VehicleCheckDocument = HydratedDocument<VehicleCheck>;

export enum VehicleCheckType { Daily = 'DAILY', Weekly = 'WEEKLY' }
export enum VehicleCheckStatus { Completed = 'COMPLETED', Open = 'OPEN', Acknowledged = 'ACKNOWLEDGED', Resolved = 'RESOLVED' }
export enum VehicleChecklistResult { Ok = 'OK', Minor = 'MINOR_DEFECT', Dangerous = 'DANGEROUS_DEFECT', NotApplicable = 'NOT_APPLICABLE' }

@Schema({ _id: false })
export class VehicleCheckItem {
  @Prop({ required: true, trim: true }) key: string;
  @Prop({ required: true, trim: true }) label: string;
  @Prop({ required: true, trim: true }) section: string;
  @Prop({ required: true, enum: Object.values(VehicleChecklistResult) }) result: VehicleChecklistResult;
  @Prop({ type: String, default: null, trim: true }) note?: string | null;
  @Prop({ type: [String], default: [] }) photoUrls: string[];
}

export const VehicleCheckItemSchema = SchemaFactory.createForClass(VehicleCheckItem);

@Schema({ _id: false })
export class VehicleCheckPhoto {
  @Prop({ required: true, trim: true }) key: string;
  @Prop({ required: true, trim: true }) label: string;
  @Prop({ required: true, trim: true }) url: string;
  @Prop({ required: true, default: false }) required: boolean;
}
export const VehicleCheckPhotoSchema = SchemaFactory.createForClass(VehicleCheckPhoto);

@Schema({ timestamps: true, collection: 'vehicle_checks' })
export class VehicleCheck {
  @Prop({ type: Types.ObjectId, ref: 'Vehicle', required: true, index: true }) vehicleId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'TeamMember', required: true, index: true }) engineerId: Types.ObjectId;
  @Prop({ required: true, enum: Object.values(VehicleCheckType), index: true }) type: VehicleCheckType;
  @Prop({ required: true, match: /^\d{4}-\d{2}-\d{2}$/ }) localDate: string;
  @Prop({ type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ }) weekStart?: string | null;
  @Prop({ type: Number, default: null, min: 0 }) odometerMiles?: number | null;
  @Prop({ type: String, default: null, enum: ['E', '1/4', '1/2', '3/4', 'F'] }) fuelLevel?: string | null;
  @Prop({ type: String, default: null }) dashboardPhotoUrl?: string | null;
  @Prop({ type: [VehicleCheckItemSchema], default: [] }) checklist: VehicleCheckItem[];
  @Prop({ type: [VehicleCheckPhotoSchema], default: [] }) weeklyPhotos: VehicleCheckPhoto[];
  @Prop({ type: String, default: null, trim: true }) conditionNote?: string | null;
  @Prop({ type: String, default: null }) signatureUrl?: string | null;
  @Prop({ required: true, default: false }) engineerConfirmed: boolean;
  @Prop({ required: true, enum: Object.values(VehicleCheckStatus), default: VehicleCheckStatus.Completed, index: true }) status: VehicleCheckStatus;
  @Prop({ required: true, default: 0, min: 0 }) defectCount: number;
  @Prop({ required: true, default: 0, min: 0 }) dangerousDefectCount: number;
  @Prop({ required: true, default: Date.now }) submittedAt: Date;
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', default: null }) acknowledgedBy?: Types.ObjectId | null;
  @Prop({ type: Date, default: null }) acknowledgedAt?: Date | null;
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', default: null }) resolvedBy?: Types.ObjectId | null;
  @Prop({ type: Date, default: null }) resolvedAt?: Date | null;
  @Prop({ type: String, default: null, trim: true }) resolutionNote?: string | null;
}

export const VehicleCheckSchema = SchemaFactory.createForClass(VehicleCheck);
VehicleCheckSchema.index({ vehicleId: 1, engineerId: 1, type: 1, localDate: 1 }, { unique: true, partialFilterExpression: { type: VehicleCheckType.Daily } });
VehicleCheckSchema.index({ vehicleId: 1, engineerId: 1, type: 1, weekStart: 1 }, { unique: true, partialFilterExpression: { type: VehicleCheckType.Weekly } });
