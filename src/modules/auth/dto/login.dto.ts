import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ClientPlatform } from '../interfaces/auth.interface';

export class LoginDto {
  @ApiProperty({ example: 'field.user@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'StrongerPass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ enum: ClientPlatform, default: ClientPlatform.Web })
  @IsOptional()
  @IsEnum(ClientPlatform)
  clientPlatform?: ClientPlatform;
}
