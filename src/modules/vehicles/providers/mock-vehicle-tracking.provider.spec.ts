import { MockVehicleTrackingProvider } from './mock-vehicle-tracking.provider';

describe('MockVehicleTrackingProvider', () => {
  it('returns a deterministic next location that preserves a stopped vehicle', async () => {
    const provider = new MockVehicleTrackingProvider();
    const next = await provider.getLatestLocation({
      vehicleId: 'vehicle-1',
      latitude: 51.5,
      longitude: -0.12,
      speed: 0,
      status: 'STOPPED',
    });

    expect(next).toMatchObject({ latitude: 51.5, longitude: -0.12, speed: 0, status: 'STOPPED' });
    expect(next.timestamp).toBeInstanceOf(Date);
  });

  it('moves an active moving vehicle and keeps a positive speed', async () => {
    const provider = new MockVehicleTrackingProvider();
    const next = await provider.getLatestLocation({
      vehicleId: 'vehicle-2',
      latitude: 51.5,
      longitude: -0.12,
      speed: 35,
      status: 'MOVING',
    });

    expect(next.status).toBe('MOVING');
    expect(next.speed).toBeGreaterThan(0);
    expect(next.latitude).not.toBe(51.5);
  });
});
