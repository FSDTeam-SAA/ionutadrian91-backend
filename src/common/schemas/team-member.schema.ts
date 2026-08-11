import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TeamMemberDocument = HydratedDocument<TeamMember>;

export class DocumentItem {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  uploadDate: string;

  @Prop({ type: String, default: null })
  expiryDate?: string | null;

  @Prop({ required: true })
  status: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  publicId: string;
}

@Schema({ timestamps: true, collection: 'team_members' })
export class TeamMember {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, trim: true })
  jobTitle: string;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Department' })
  departmentId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  workerType: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;

  @Prop({ required: true, trim: true })
  shiftName: string;

  @Prop({ type: [String], default: [] })
  weekendDays: string[];

  @Prop({ required: true, trim: true })
  portalPermission: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  workEmail: string;

  @Prop({ required: true, trim: true })
  phoneNumber: string;

  @Prop({ type: String, default: null, trim: true })
  homeAddress?: string | null;

  @Prop({ required: true, trim: true })
  emergencyContactName: string;

  @Prop({ required: true, trim: true })
  emergencyContactPhoneNumber: string;

  @Prop({ type: String, default: null })
  photoUrl?: string | null;

  @Prop({ type: String, select: false, default: null })
  photoPublicId?: string | null;

  @Prop({ required: true, default: false })
  hasPhoto: boolean;

  @Prop({ type: Boolean, default: false })
  isCompleted: boolean;

  @Prop({ type: [Object], default: [] })
  documents: DocumentItem[];

  @Prop({ type: Number, default: 0 })
  leaveBalance: number;
}

export const TeamMemberSchema = SchemaFactory.createForClass(TeamMember);
TeamMemberSchema.index({ departmentId: 1 });
