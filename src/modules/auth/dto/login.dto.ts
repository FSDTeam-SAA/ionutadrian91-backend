import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ClientPlatform } from '../interfaces/auth.interface';

export class LoginDto {
  @ApiProperty({ example: 'field.user@example.com' })
  @IsString()
  @MaxLength(254)
  identifier: string;

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
