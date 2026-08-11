import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveStatus } from '../../../common/schemas/leave-request.schema';

export class UpdateLeaveStatusDto {
  @ApiProperty({ enum: LeaveStatus, example: LeaveStatus.APPROVED })
  @IsEnum(LeaveStatus)
  @IsNotEmpty()
  status: LeaveStatus;
}
