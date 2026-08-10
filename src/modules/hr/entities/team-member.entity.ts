import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TeamMemberEntity {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiProperty() jobTitle: string;
  @ApiProperty() departmentId: string;
  @ApiProperty() workerType: string;
  @ApiProperty() startDate: Date;
  @ApiProperty() startTime: string;
  @ApiProperty() endTime: string;
  @ApiProperty() shiftName: string;
  @ApiProperty({ type: [String], example: ['SA', 'SU'] }) weekendDays: string[];
  @ApiProperty() portalPermission: string;
  @ApiProperty() workEmail: string;
  @ApiProperty() phoneNumber: string;
  @ApiPropertyOptional() homeAddress?: string | null;
  @ApiProperty() emergencyContactName: string;
  @ApiProperty() emergencyContactPhoneNumber: string;
  @ApiProperty() hasPhoto: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
