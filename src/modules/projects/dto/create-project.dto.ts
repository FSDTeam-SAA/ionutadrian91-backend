import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '../../../common/schemas/project.schema';

export class CreateProjectDto {
  @ApiProperty({ example: 'Website Redesign', description: 'Name of the project' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Redesigning the corporate website', description: 'Project description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: '2026-09-01', description: 'Timeline start date' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2026-12-31', description: 'Timeline end date' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ example: 'Acme Corporation', description: 'Name of the client' })
  @IsString()
  @IsNotEmpty()
  clientName: string;

  @ApiPropertyOptional({ enum: ProjectStatus, example: ProjectStatus.PENDING })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
