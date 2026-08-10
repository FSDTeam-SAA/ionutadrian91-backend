import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Human Resources' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'ID of the user assigned as department head' })
  @IsMongoId()
  headId: string;

  @ApiProperty({
    example: 'Responsible for recruitment and employee wellbeing.',
  })
  @IsString()
  @MaxLength(2000)
  description: string;
}
