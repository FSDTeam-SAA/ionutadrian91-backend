import { Injectable } from '@nestjs/common';
import { VehicleStatus } from '../../../common/schemas/vehicle.schema';
import { TrackableVehicle, TrackingSnapshot, VehicleTrackingProvider } from './vehicle-tracking.provider';

@Injectable()
export class MockVehicleTrackingProvider extends VehicleTrackingProvider {
  async getLatestLocation(vehicle: TrackableVehicle): Promise<TrackingSnapshot> {
    if (vehicle.status !== VehicleStatus.Moving) return { ...vehicle, speed: vehicle.status === VehicleStatus.Stopped ? 0 : vehicle.speed, timestamp: new Date() };
    const offset = ((vehicle.vehicleId.charCodeAt(vehicle.vehicleId.length - 1) || 1) % 5 + 1) / 10000;
    return { ...vehicle, latitude: vehicle.latitude + offset, longitude: vehicle.longitude + offset / 2, speed: Math.max(1, vehicle.speed + 1), timestamp: new Date() };
  }
}
