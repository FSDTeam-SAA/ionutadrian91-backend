import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class LocationDto {
  @ApiProperty({ example: '123 Main St, NY', description: 'Address string' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 40.7128 })
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ example: -74.006 })
  @IsNotEmpty()
  longitude: number;
}

export class CreateIncidentDto {
  @ApiProperty({ example: '60d5ecb8b392d7001f3e2a1b', description: 'Project ID' })
  @IsMongoId()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ example: 'Equipment Failure' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: '2026-08-15T09:00:00Z', description: 'Date and Time of Incident' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: 'Worker fell from ladder' })
  @IsString()
  @IsNotEmpty()
  details: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
    description: 'Optional photo of evidence',
  })
  photo?: unknown;

  @ApiProperty({ type: LocationDto, description: 'Send as stringified JSON if using FormData multipart' })
  @ValidateNested()
  @Type(() => LocationDto)
  @IsNotEmpty()
  location: LocationDto;
}
