import { Module } from '@nestjs/common';
import { MockVehicleTrackingProvider } from './providers/mock-vehicle-tracking.provider';
import { VehicleTrackingProvider } from './providers/vehicle-tracking.provider';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
@Module({ controllers: [VehiclesController], providers: [VehiclesService, MockVehicleTrackingProvider, { provide: VehicleTrackingProvider, useExisting: MockVehicleTrackingProvider }] })
export class VehiclesModule {}
