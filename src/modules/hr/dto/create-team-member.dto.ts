import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEmail,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const WEEK_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

export class CreateTeamMemberDto {
  @ApiProperty({ type: 'string', format: 'binary', required: false })
  photo?: unknown;

  @ApiProperty({ example: 'Jane Stewart' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ example: 'Field Engineer' })
  @IsString()
  @MaxLength(120)
  jobTitle: string;

  @ApiProperty({ description: 'Department ID' })
  @IsMongoId()
  departmentId: string;

  @ApiProperty({ example: 'Full-time' })
  @IsString()
  @MaxLength(80)
  workerType: string;

  @ApiProperty({ example: '2026-08-10' })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({ example: '08:00', description: '24-hour time (HH:mm)' })
  @IsString()
  @Matches(/^([01]\\d|2[0-3]):[0-5]\\d$/)
  startTime: string;

  @ApiProperty({ example: '18:00', description: '24-hour time (HH:mm)' })
  @IsString()
  @Matches(/^([01]\\d|2[0-3]):[0-5]\\d$/)
  endTime: string;

  @ApiProperty({ example: 'Day shift' })
  @IsString()
  @MaxLength(100)
  shiftName: string;

  @ApiProperty({ enum: WEEK_DAYS, isArray: true, example: ['SA', 'SU'] })
  @IsArray()
  @IsIn(WEEK_DAYS, { each: true })
  weekendDays: (typeof WEEK_DAYS)[number][];

  @ApiProperty({ example: 'Engineer' })
  @IsString()
  @MaxLength(80)
  portalPermission: string;

  @ApiProperty({ example: 'jane.stewart@example.com' })
  @IsEmail()
  @MaxLength(254)
  workEmail: string;

  @ApiProperty({ example: '+44 (0) 7000 000 000' })
  @IsString()
  @MaxLength(40)
  phoneNumber: string;

  @ApiPropertyOptional({ example: '10 Example Street, London' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  homeAddress?: string;

  @ApiProperty({ example: 'John Stewart' })
  @IsString()
  @MaxLength(120)
  emergencyContactName: string;

  @ApiProperty({ example: '+44 (0) 7000 000 001' })
  @IsString()
  @MaxLength(40)
  emergencyContactPhoneNumber: string;
}
