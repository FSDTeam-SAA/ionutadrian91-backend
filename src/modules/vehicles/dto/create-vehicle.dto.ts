import { IsBoolean, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { VehicleStatus } from '../../../common/schemas/vehicle.schema';

export class CreateVehicleDto {
  @IsString() @MaxLength(32) registrationNumber: string;
  @IsString() @MaxLength(64) trackerId: string;
  @IsOptional() @IsMongoId() assignedEngineerId?: string;
  @IsOptional() @IsEnum(VehicleStatus) status?: VehicleStatus;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsNumber() @Min(0) speed?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
