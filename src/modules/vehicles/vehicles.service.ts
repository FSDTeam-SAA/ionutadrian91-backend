import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser, TeamMember, Vehicle, VehicleLocationHistory, VehicleStatus } from '../../common/schemas';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { LocationHistoryQueryDto } from './dto/location-history-query.dto';
import { VehicleTrackingProvider } from './providers/vehicle-tracking.provider';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectModel(Vehicle.name) private readonly vehicles: Model<Vehicle>,
    @InjectModel(VehicleLocationHistory.name) private readonly history: Model<VehicleLocationHistory>,
    @InjectModel(TeamMember.name) private readonly engineers: Model<TeamMember>,
    @InjectModel(AuthUser.name) private readonly users: Model<AuthUser>,
    private readonly trackingProvider: VehicleTrackingProvider,
  ) {}

  async create(dto: CreateVehicleDto) {
    await this.assertEngineer(dto.assignedEngineerId);
    try { return this.toResponse(await this.vehicles.create({ ...dto, assignedEngineerId: dto.assignedEngineerId ? new Types.ObjectId(dto.assignedEngineerId) : null, registrationNumber: dto.registrationNumber.trim().toUpperCase(), trackerId: dto.trackerId.trim(), lastUpdatedAt: dto.latitude !== undefined && dto.longitude !== undefined ? new Date() : null })); }
    catch (error: any) { if (error?.code === 11000) throw new ConflictException('Vehicle registration number and tracker ID must be unique'); throw error; }
  }

  async findAll() { return Promise.all((await this.vehicles.find().sort({ registrationNumber: 1 }).exec()).map((vehicle) => this.toResponse(vehicle))); }
  async findOne(id: string) { return this.toResponse(await this.findVehicle(id)); }

  async update(id: string, dto: UpdateVehicleDto) {
    await this.assertEngineer(dto.assignedEngineerId);
    const data: Record<string, unknown> = { ...dto };
    if (dto.assignedEngineerId) data.assignedEngineerId = new Types.ObjectId(dto.assignedEngineerId);
    if (dto.registrationNumber) data.registrationNumber = dto.registrationNumber.trim().toUpperCase();
    if (dto.trackerId) data.trackerId = dto.trackerId.trim();
    if (dto.latitude !== undefined || dto.longitude !== undefined) data.lastUpdatedAt = new Date();
    try { const vehicle = await this.vehicles.findByIdAndUpdate(id, data, { new: true }).exec(); if (!vehicle) throw new NotFoundException('Vehicle not found'); return this.toResponse(vehicle); }
    catch (error: any) { if (error?.code === 11000) throw new ConflictException('Vehicle registration number and tracker ID must be unique'); throw error; }
  }

  async remove(id: string) { const result = await this.vehicles.findByIdAndDelete(id).exec(); if (!result) throw new NotFoundException('Vehicle not found'); await this.history.deleteMany({ vehicleId: result._id }).exec(); return { deleted: true }; }

  async assignEngineer(id: string, assignedEngineerId?: string | null) {
    await this.assertEngineer(assignedEngineerId || undefined);
    const vehicle = await this.vehicles.findByIdAndUpdate(id, { assignedEngineerId: assignedEngineerId ? new Types.ObjectId(assignedEngineerId) : null }, { new: true }).exec();
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return this.toResponse(vehicle);
  }

  async getLocation(id: string) { const vehicle = await this.findVehicle(id); return { id: vehicle.id, registrationNumber: vehicle.registrationNumber, latitude: vehicle.latitude, longitude: vehicle.longitude, speed: vehicle.speed, status: vehicle.status, lastUpdatedAt: vehicle.lastUpdatedAt }; }

  async getHistory(id: string, query: LocationHistoryQueryDto) {
    await this.findVehicle(id);
    const timestamp: Record<string, Date> = {};
    if (query.from) timestamp.$gte = new Date(query.from);
    if (query.to) timestamp.$lte = new Date(query.to);
    return this.history.find({ vehicleId: id, ...(Object.keys(timestamp).length ? { timestamp } : {}) }).sort({ timestamp: 1 }).lean().exec();
  }

  async getLiveVehicles() {
    const activeVehicles = await this.vehicles.find({ isActive: true }).exec();
    await Promise.all(activeVehicles.map((vehicle) => this.refreshMockLocation(vehicle)));
    return Promise.all((await this.vehicles.find({ isActive: true }).sort({ registrationNumber: 1 }).exec()).map((vehicle) => this.toResponse(vehicle)));
  }

  async getMyVehicle(engineerId: string) {
    const user = await this.users.findById(engineerId).select('email').lean().exec();
    const engineer = user ? await this.engineers.findOne({ workEmail: user.email }).select('_id').lean().exec() : null;
    const vehicle = engineer ? await this.vehicles.findOne({ isActive: true, $expr: { $eq: [{ $toString: '$assignedEngineerId' }, engineer._id.toString()] } } as any).exec() : null;
    if (!vehicle) throw new NotFoundException('No active vehicle is assigned to you');
    return this.toResponse(vehicle);
  }

  private async refreshMockLocation(vehicle: any) {
    if (vehicle.latitude === null || vehicle.longitude === null || vehicle.latitude === undefined || vehicle.longitude === undefined) return;
    const snapshot = await this.trackingProvider.getLatestLocation({ vehicleId: vehicle.id, latitude: vehicle.latitude, longitude: vehicle.longitude, speed: vehicle.speed, status: vehicle.status });
    await this.vehicles.findByIdAndUpdate(vehicle._id, { latitude: snapshot.latitude, longitude: snapshot.longitude, speed: snapshot.speed, status: snapshot.status, lastUpdatedAt: snapshot.timestamp }).exec();
    await this.history.create({ vehicleId: vehicle._id, latitude: snapshot.latitude, longitude: snapshot.longitude, speed: snapshot.speed, status: snapshot.status, timestamp: snapshot.timestamp });
  }

  private async findVehicle(id: string) { if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Vehicle not found'); const vehicle = await this.vehicles.findById(id).exec(); if (!vehicle) throw new NotFoundException('Vehicle not found'); return vehicle; }
  private async assertEngineer(id?: string) { if (!id) return; if (!Types.ObjectId.isValid(id) || !(await this.engineers.exists({ _id: id }))) throw new BadRequestException('Assigned engineer was not found'); }
  private async toResponse(vehicle: any) { const engineer = vehicle.assignedEngineerId ? await this.engineers.findById(vehicle.assignedEngineerId).select('fullName').lean().exec() : null; const data = vehicle.toObject ? vehicle.toObject() : vehicle; return { ...data, id: data._id?.toString() ?? data.id, _id: undefined, assignedEngineerId: data.assignedEngineerId?.toString?.() ?? data.assignedEngineerId, engineer: engineer ? { id: engineer._id.toString(), name: engineer.fullName } : null }; }
}
