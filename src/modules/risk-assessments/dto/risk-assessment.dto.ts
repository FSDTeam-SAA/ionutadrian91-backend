import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { RiskAssessmentStatus } from '../../../common/schemas';
class HazardDto {
  @IsString() hazard: string;
  @IsString() risk: string;
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) riskLevel:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';
  @IsArray() @IsString({ each: true }) controlMeasures: string[];
}
export class CreateRiskAssessmentDto {
  @IsMongoId() projectId: string;
  @IsMongoId() assignmentId: string;
  @IsOptional() @IsObject() answers?: Record<string, string>;
  @IsOptional() @IsArray() @IsString({ each: true }) photoUrls?: string[];
  @IsOptional() @IsString() signatureUrl?: string;
  @IsOptional() @IsBoolean() engineerConfirmed?: boolean;
  @IsOptional() @IsObject() location?: { latitude: number; longitude: number };
}
export class UpdateRiskAssessmentDto extends PartialType(
  CreateRiskAssessmentDto,
) {}
export class RiskAssessmentQueryDto {
  @IsOptional() @IsMongoId() projectId?: string;
  @IsOptional() @IsMongoId() assignmentId?: string;
  @IsOptional() @IsEnum(RiskAssessmentStatus) status?: RiskAssessmentStatus;
}
