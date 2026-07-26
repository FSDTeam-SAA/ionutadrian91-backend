import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuthSecurityDocument = HydratedDocument<AuthSecurity>;

@Schema({ timestamps: true, collection: 'auth_security' })
export class AuthSecurity {
  @Prop({ type: Types.ObjectId, required: true, ref: 'AuthUser', unique: true })
  authId: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  failedAttempts: number;

  @Prop({ type: Date, default: null })
  lastFailedAt?: Date | null;

  @Prop({ type: Date, default: null })
  lockExpiresAt?: Date | null;

  @Prop({ required: true, default: false })
  mfaEnabled: boolean;

  @Prop({ type: Date, default: null })
  lastPasswordChange?: Date | null;

  @Prop({ type: String, default: null })
  emailVerificationOtpHash?: string | null;

  @Prop({ type: Date, default: null })
  emailVerificationOtpExpiresAt?: Date | null;

  @Prop({ type: Date, default: null })
  emailVerificationOtpLastSentAt?: Date | null;

  @Prop({ type: String, default: null })
  passwordResetOtpHash?: string | null;

  @Prop({ type: Date, default: null })
  passwordResetOtpExpiresAt?: Date | null;

  @Prop({ type: Date, default: null })
  passwordResetOtpLastSentAt?: Date | null;
}

export const AuthSecuritySchema = SchemaFactory.createForClass(AuthSecurity);
