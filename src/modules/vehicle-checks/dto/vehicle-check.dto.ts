import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min, ValidateNested } from 'class-validator';
import { VehicleCheckType, VehicleChecklistResult, VehicleCheckStatus } from '../../../common/schemas';

export class ChecklistItemDto {
  @IsString() @MaxLength(80) key: string;
  @IsEnum(VehicleChecklistResult) result: VehicleChecklistResult;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsUrl({}, { each: true }) photoUrls?: string[];
}
export class WeeklyPhotoDto {
  @IsString() @MaxLength(50) key: string;
  @IsUrl() url: string;
}
export class SubmitVehicleCheckDto {
  @IsEnum(VehicleCheckType) type: VehicleCheckType;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) odometerMiles?: number;
  @IsOptional() @IsEnum(['E', '1/4', '1/2', '3/4', 'F']) fuelLevel?: string;
  @IsOptional() @IsUrl() dashboardPhotoUrl?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ChecklistItemDto) checklist?: ChecklistItemDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WeeklyPhotoDto) weeklyPhotos?: WeeklyPhotoDto[];
  @IsOptional() @IsString() @MaxLength(2000) conditionNote?: string;
  @IsOptional() @IsUrl() signatureUrl?: string;
  @IsOptional() @IsString() vehicleId?: string;
  @IsBoolean() engineerConfirmed: boolean;
}
export class VehicleChecksQueryDto {
  @IsOptional() @IsEnum(VehicleCheckType) type?: VehicleCheckType;
  @IsOptional() @IsEnum(VehicleCheckStatus) status?: VehicleCheckStatus;
  @IsOptional() @IsString() vehicleId?: string;
  @IsOptional() @IsString() engineerId?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsEnum(['MINOR', 'DANGEROUS']) defectSeverity?: 'MINOR' | 'DANGEROUS';
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number = 20;
}
export class ResolveVehicleDefectDto { @IsString() @MaxLength(2000) resolutionNote: string; }
