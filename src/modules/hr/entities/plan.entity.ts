import { ApiProperty } from '@nestjs/swagger';
import { HrPlanStatus } from '../../../common/schemas';

export class PlanEntity {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty() departmentId: string;
  @ApiProperty({ enum: HrPlanStatus }) status: HrPlanStatus;
  @ApiProperty() startDate: Date;
  @ApiProperty() endDate: Date;
  @ApiProperty() createdById: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
