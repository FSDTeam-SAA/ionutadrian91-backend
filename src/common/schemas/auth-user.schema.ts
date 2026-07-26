import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuthUserDocument = HydratedDocument<AuthUser>;

@Schema({ timestamps: true, collection: 'auth_users' })
export class AuthUser {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true, default: '' })
  password: string;

  @Prop({ required: true, default: 'USER' })
  role: string;

  @Prop({ required: true, default: false })
  verified: boolean;

  @Prop({ required: true, default: 'ACTIVE' })
  status: string;

  @Prop({ required: true, default: 'local' })
  provider: string;

  @Prop({ type: String, default: null })
  providerId?: string | null;

  @Prop({ required: true, default: 0 })
  tokenVersion: number;
}

export const AuthUserSchema = SchemaFactory.createForClass(AuthUser);

AuthUserSchema.index({ provider: 1, providerId: 1 });
AuthUserSchema.virtual('authSecurity', {
  ref: 'AuthSecurity',
  localField: '_id',
  foreignField: 'authId',
  justOne: true,
});
AuthUserSchema.set('toJSON', { virtuals: true });
AuthUserSchema.set('toObject', { virtuals: true });
