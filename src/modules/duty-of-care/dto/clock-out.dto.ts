import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClockOutDto {
  @ApiPropertyOptional({ description: 'Any issues or notes during clock out', example: 'Finished the foundation work' })
  @IsOptional()
  @IsString()
  notes?: string;
}
