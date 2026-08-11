import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClockInDto {
  @ApiPropertyOptional({ description: 'ID of the project they are working on', example: '60d5ecb8b392d7001f3e2a1b' })
  @IsOptional()
  @IsMongoId()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Any issues or notes during clock in', example: 'Everything looks good' })
  @IsOptional()
  @IsString()
  notes?: string;
}
