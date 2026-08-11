import { PartialType } from '@nestjs/swagger';
import { CreateWhereaboutsDto } from './create-whereabouts.dto';

export class UpdateWhereaboutsDto extends PartialType(CreateWhereaboutsDto) {}
