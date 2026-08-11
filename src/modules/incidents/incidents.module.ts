import { Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { CloudinaryService } from '../../common/services/cloudinary.service';

@Module({
  controllers: [IncidentsController],
  providers: [IncidentsService, CloudinaryService],
})
export class IncidentsModule {}
