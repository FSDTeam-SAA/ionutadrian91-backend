import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { HrPlanStatus } from '../../../common/schemas';

export class CreatePlanDto {
  @ApiProperty({ example: 'Q4 Recruitment Plan' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title: string;

  @ApiProperty({
    example: 'Hire three engineers before the end of the quarter.',
  })
  @IsString()
  @MaxLength(4000)
  description: string;

  @ApiProperty()
  @IsMongoId()
  departmentId: string;

  @ApiPropertyOptional({ enum: HrPlanStatus, default: HrPlanStatus.Draft })
  @IsOptional()
  @IsEnum(HrPlanStatus)
  status?: HrPlanStatus;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({ example: '2026-12-31T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  endDate: Date;
}
