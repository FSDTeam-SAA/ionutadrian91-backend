import { IsMongoId, IsOptional } from 'class-validator';
export class AssignEngineerDto { @IsOptional() @IsMongoId() assignedEngineerId?: string | null; }
