import { Module } from '@nestjs/common';
import { WhereaboutsController } from './whereabouts.controller';
import { WhereaboutsService } from './whereabouts.service';

@Module({
  controllers: [WhereaboutsController],
  providers: [WhereaboutsService],
})
export class WhereaboutsModule {}
