import { Module } from '@nestjs/common';
import { DutyOfCareController } from './duty-of-care.controller';
import { DutyOfCareService } from './duty-of-care.service';

@Module({
  controllers: [DutyOfCareController],
  providers: [DutyOfCareService],
})
export class DutyOfCareModule {}
