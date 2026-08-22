import { IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { JobStatus } from '../../../common/schemas/job.schema';

export class CreateJobDto {
  @IsMongoId() projectId: string;
  @IsString() @IsNotEmpty() @MaxLength(40) jobReference: string;
  @IsString() @IsNotEmpty() @MaxLength(160) title: string;
  @IsString() @IsNotEmpty() @MaxLength(4000) description: string;
  @IsString() @IsNotEmpty() @MaxLength(160) client: string;
  @IsString() @IsNotEmpty() @MaxLength(300) location: string;
  @IsOptional() @IsMongoId() assignedEngineerId?: string;
  @IsOptional() @IsMongoId() assignedSupervisorId?: string;
  @IsOptional() @IsString() @MaxLength(100) assignedTeamId?: string;
  @IsDateString() startDate: string;
  @IsDateString() expectedCompletionDate: string;
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
}
