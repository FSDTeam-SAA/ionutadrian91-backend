import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, MaxLength } from 'class-validator';

export enum OtpPurpose {
  VerifyEmail = 'VERIFY_EMAIL',
  ResetPassword = 'RESET_PASSWORD',
}

export class ResendOtpDto {
  @ApiProperty({ example: 'field.user@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ enum: OtpPurpose })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
