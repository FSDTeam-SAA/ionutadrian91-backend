import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';
import { JobStatus } from '../../../common/schemas/job.schema';
export class ListJobsQueryDto {
  @IsOptional() @IsMongoId() projectId?: string;
  @IsOptional() @IsMongoId() engineerId?: string;
  @IsOptional() @IsMongoId() supervisorId?: string;
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
