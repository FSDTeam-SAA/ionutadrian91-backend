import { Module } from '@nestjs/common';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import { VehicleChecksController } from './vehicle-checks.controller';
import { VehicleChecksService } from './vehicle-checks.service';
@Module({ controllers: [VehicleChecksController], providers: [VehicleChecksService, CloudinaryService] })
export class VehicleChecksModule {}
