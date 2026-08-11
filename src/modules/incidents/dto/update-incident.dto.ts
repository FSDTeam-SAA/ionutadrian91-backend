import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateIncidentDto } from './create-incident.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IncidentStatus } from '../../../common/schemas/incident-report.schema';

export class UpdateIncidentDto extends PartialType(CreateIncidentDto) {
  @ApiPropertyOptional({ enum: IncidentStatus, example: IncidentStatus.INVESTIGATING })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional({ example: 'Reviewed the CCTV footage.' })
  @IsOptional()
  @IsString()
  investigationDetails?: string;

  @ApiPropertyOptional({ example: 'Ladder was faulty.' })
  @IsOptional()
  @IsString()
  rootCause?: string;
}
