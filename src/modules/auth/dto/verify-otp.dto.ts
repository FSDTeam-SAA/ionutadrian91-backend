import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'field.user@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp: string;
}

export class VerifyOtpResponseDto {
  @ApiProperty()
  verified: boolean;

  @ApiProperty({
    description: 'Short-lived token required by /auth/change-password.',
  })
  resetToken: string;

  @ApiProperty({ example: 600 })
  expiresIn: number;
}
