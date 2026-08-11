import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentItemEntity {
  @ApiProperty() name: string;
  @ApiProperty() category: string;
  @ApiProperty() uploadDate: string;
  @ApiPropertyOptional() expiryDate?: string | null;
  @ApiProperty() status: string;
  @ApiProperty() url: string;
}

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
  @ApiPropertyOptional({
    format: 'uri',
    description: 'Secure Cloudinary URL for the team-member profile photo.',
  })
  photoUrl?: string | null;
  @ApiProperty({ type: [DocumentItemEntity] }) documents: DocumentItemEntity[];
  @ApiProperty() isCompleted: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
