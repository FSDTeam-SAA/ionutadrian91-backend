import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { HrPlanStatus } from '../../../common/schemas';

export class ListPlansDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() departmentId?: string;
  @ApiPropertyOptional({ enum: HrPlanStatus })
  @IsOptional()
  @IsEnum(HrPlanStatus)
  status?: HrPlanStatus;
}
