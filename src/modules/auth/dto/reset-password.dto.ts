import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'field.user@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({
    example: 'reset-token-from-verify-otp',
    description: 'Returned by /auth/verify-otp. Preferred password reset flow.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  resetToken?: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Backward-compatible direct reset path.',
  })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  otp?: string;

  @ApiProperty({ example: 'NewStrongerPass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
