import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserProfileDocument = HydratedDocument<UserProfile>;

@Schema({ timestamps: true, collection: 'user_profiles' })
export class UserProfile {
  @Prop({ type: Types.ObjectId, required: true, ref: 'AuthUser', unique: true })
  authId: Types.ObjectId;

  @Prop({ default: '' })
  firstName: string;

  @Prop({ default: '' })
  lastName: string;

  @Prop({ type: String, default: null })
  avatarUrl?: string | null;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
