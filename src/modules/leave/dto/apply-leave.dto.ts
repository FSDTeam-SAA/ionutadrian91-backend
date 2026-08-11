import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyLeaveDto {
  @ApiProperty({ example: '2026-08-15', description: 'Start date of leave' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2026-08-20', description: 'End date of leave' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ example: 'Medical leave due to fever', description: 'Reason for leave' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Optional supporting document' })
  @IsOptional()
  file?: any;
}
