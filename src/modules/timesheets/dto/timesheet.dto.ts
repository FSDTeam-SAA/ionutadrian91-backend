import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { TimesheetStatus } from '../../../common/schemas';

export class TimesheetItemDto {
  @IsString() @MaxLength(40) rateCode: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(1000000) quantity: number;
  @IsOptional() @IsString() @MaxLength(80) buildStatus?: string;
  @IsOptional() @IsString() @MaxLength(1000) comments?: string;
}
export class CreateTimesheetDto {
  @IsDateString() claimDate: string;
  @IsOptional() @IsArray() @IsMongoId({ each: true }) engineerIds?: string[];
  @IsString() @MaxLength(120) townCity: string;
  @IsString() @MaxLength(80) jobNumber: string;
  @IsString() @MaxLength(80) polygonType: string;
  @IsString() @MaxLength(120) polygonId: string;
  @IsString() @MaxLength(120) featureId: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TimesheetItemDto) items: TimesheetItemDto[];
}
export class ListTimesheetsQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsMongoId() engineerId?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsEnum(TimesheetStatus) status?: TimesheetStatus;
  @IsOptional() @IsString() @MaxLength(40) rateCode?: string;
  @IsOptional() @IsString() @MaxLength(120) townCity?: string;
  @IsOptional() @IsString() @MaxLength(80) jobNumber?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) limit = 20;
}
export class UpdateTimesheetStatusDto {
  @IsEnum(TimesheetStatus) status: TimesheetStatus;
  @IsOptional() @IsString() @MaxLength(1000) rejectionReason?: string;
}
