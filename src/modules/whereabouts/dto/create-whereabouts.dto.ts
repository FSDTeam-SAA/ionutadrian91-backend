import {
  IsArray,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class LocationDto {
  @ApiProperty({ example: '123 Main St, NY', description: 'Address string' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({ example: 40.7128 })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: -74.006 })
  @IsOptional()
  longitude?: number;
}

export class CreateWhereaboutsDto {
  @ApiProperty({ example: 'Bridge Construction Assignment' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: '60d5ecb8b392d7001f3e2a1b', description: 'Project ID' })
  @IsMongoId()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ example: '2026-08-15T09:00:00Z', description: 'Start Date and Time' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2026-08-15T17:00:00Z', description: 'End Date and Time' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ type: [LocationDto] })
  @ValidateNested({ each: true })
  @Type(() => LocationDto)
  @IsNotEmpty()
  locations: LocationDto[];

  @ApiPropertyOptional({ type: [String], description: 'Array of TeamMember IDs (Engineers)' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  engineers?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Array of TeamMember IDs (Workers)' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  workers?: string[];

  @ApiPropertyOptional({ example: 'Bring heavy machinery' })
  @IsOptional()
  @IsString()
  notes?: string;
}
