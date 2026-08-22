import { IsDateString, IsOptional } from 'class-validator';
export class LocationHistoryQueryDto { @IsOptional() @IsDateString() from?: string; @IsOptional() @IsDateString() to?: string; }
