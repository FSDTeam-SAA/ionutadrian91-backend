import { VehicleStatus } from '../../../common/schemas/vehicle.schema';

export type TrackingSnapshot = { vehicleId: string; latitude: number; longitude: number; speed: number; status: VehicleStatus; timestamp: Date };
export type TrackableVehicle = Omit<TrackingSnapshot, 'timestamp'>;

export abstract class VehicleTrackingProvider {
  abstract getLatestLocation(vehicle: TrackableVehicle): Promise<TrackingSnapshot>;
}
