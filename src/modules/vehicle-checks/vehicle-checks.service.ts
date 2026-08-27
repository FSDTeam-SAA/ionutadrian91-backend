import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser, TeamMember, Vehicle, VehicleCheck, VehicleCheckDocument, VehicleChecklistResult, VehicleCheckStatus, VehicleCheckType } from '../../common/schemas';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import { ResolveVehicleDefectDto, SubmitVehicleCheckDto, VehicleChecksQueryDto } from './dto/vehicle-check.dto';

const DAILY_ITEMS = [
  ['front-view-mirrors-cameras-glass', 'Front view, mirrors, cameras & glass', 'Inside the cab'],
  ['windscreen-washers-wipers', 'Windscreen washers & wipers', 'Inside the cab'],
  ['dashboard-warning-lights', 'Dashboard warning lights', 'Inside the cab'],
  ['steering', 'Steering', 'Inside the cab'], ['horn', 'Horn', 'Inside the cab'],
  ['brakes-foot-parking', 'Brakes — foot & parking', 'Inside the cab'], ['seats-seat-belts', 'Seats & seat belts', 'Inside the cab'],
  ['lights-indicators', 'Lights & indicators', 'Outside the van'], ['fluids-fuel-oil', 'Fluids, fuel & oil', 'Outside the van'],
  ['battery', 'Battery', 'Outside the van'], ['bodywork-doors', 'Bodywork & doors', 'Outside the van'],
  ['tyres-wheels', 'Tyres & wheels', 'Outside the van'], ['load-equipment-secure', 'Load / equipment secure', 'Outside the van'],
  ['adblue', 'AdBlue (diesel exhaust fluid)', 'Outside the van'], ['exhaust', 'Exhaust', 'Outside the van'],
  ['alternative-fuel-system-isolation', 'Alternative fuel system & isolation', 'Outside the van'], ['number-plates', 'Number plates', 'Outside the van'],
  ['tow-bar-trailer', 'Tow bar & trailer', 'Outside the van'], ['tail-lift-specialist-equipment', 'Tail lift / specialist equipment', 'Outside the van'],
] as const;
const REQUIRED_WEEKLY_PHOTOS = ['front', 'rear', 'nearside-left', 'offside-right', 'cab-interior', 'load-area'];
const WEEKLY_PHOTO_LABELS: Record<string, string> = {
  front: 'Front', rear: 'Rear', 'nearside-left': 'Nearside (left)',
  'offside-right': 'Offside (right)', roof: 'Roof', 'cab-interior': 'Cab interior',
  'load-area': 'Load area', dashboard: 'Dashboard',
};

@Injectable()
export class VehicleChecksService {
  constructor(
    @InjectModel(VehicleCheck.name) private readonly checks: Model<VehicleCheckDocument>,
    @InjectModel(Vehicle.name) private readonly vehicles: Model<Vehicle>,
    @InjectModel(TeamMember.name) private readonly engineers: Model<TeamMember>,
    @InjectModel(AuthUser.name) private readonly users: Model<AuthUser>,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async upload(userId: string, file?: Express.Multer.File) {
    await this.getEngineer(userId);
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('Upload a JPG, PNG, or WebP image');
    if (file.size > 8 * 1024 * 1024) throw new BadRequestException('Image must be 8 MB or smaller');
    return this.cloudinary.uploadVehicleCheckPhoto(file.buffer, file.mimetype);
  }

  async dueState(userId: string, vehicleId?: string) {
    const engineer = await this.getEngineer(userId);
    let vehicle;
    if (vehicleId) {
      vehicle = await this.vehicles.findOne({ _id: vehicleId, isActive: true }).lean().exec();
    } else {
      vehicle = await this.vehicles.findOne({ isActive: true, assignedEngineerId: engineer._id }).lean().exec();
    }
    
    const activeVehicles = await this.vehicles.find({ isActive: true }).select('_id registrationNumber').sort({ registrationNumber: 1 }).lean().exec();
    
    if (!vehicle) {
       return { vehicle: null, activeVehicles: activeVehicles.map((v) => ({ id: v._id.toString(), registrationNumber: v.registrationNumber })) };
    }

    const localDate = this.londonDate(); const weekStart = this.mondayOf(localDate);
    const [daily, weekly, recent, month] = await Promise.all([
      this.checks.exists({ vehicleId: vehicle._id, engineerId: engineer._id, type: VehicleCheckType.Daily, localDate }),
      this.checks.exists({ vehicleId: vehicle._id, engineerId: engineer._id, type: VehicleCheckType.Weekly, weekStart }),
      this.checks.find({ vehicleId: vehicle._id, engineerId: engineer._id }).sort({ submittedAt: -1 }).limit(5).lean().exec(),
      this.checks.countDocuments({ vehicleId: vehicle._id, engineerId: engineer._id, localDate: { $gte: `${localDate.slice(0, 7)}-01`, $lte: localDate } }),
    ]);
    return { vehicle: { id: vehicle._id.toString(), registrationNumber: vehicle.registrationNumber, trackerId: vehicle.trackerId }, activeVehicles: activeVehicles.map((v) => ({ id: v._id.toString(), registrationNumber: v.registrationNumber })), timezone: 'Europe/London', localDate, weekStart, daily: { due: !daily, completed: !!daily }, weekly: { due: !weekly && localDate >= weekStart, completed: !!weekly }, stats: { checksThisMonth: month, openDefects: await this.checks.countDocuments({ vehicleId: vehicle._id, engineerId: engineer._id, status: { $in: [VehicleCheckStatus.Open, VehicleCheckStatus.Acknowledged] } }) }, recent };
  }

  async mine(userId: string, query: VehicleChecksQueryDto) {
    const engineer = await this.getEngineer(userId);
    return this.paginate({ engineerId: engineer._id, ...this.filters(query) }, query);
  }
  async mineOne(id: string, userId: string) { const engineer = await this.getEngineer(userId); return this.findOne(id, { engineerId: engineer._id }); }

  async submit(userId: string, dto: SubmitVehicleCheckDto) {
    const engineer = await this.getEngineer(userId);
    let vehicle;
    if (dto.vehicleId) {
      vehicle = await this.vehicles.findOne({ _id: dto.vehicleId, isActive: true }).lean().exec();
    } else {
      vehicle = await this.vehicles.findOne({ isActive: true, assignedEngineerId: engineer._id }).lean().exec();
    }
    if (!vehicle) throw new BadRequestException('Selected vehicle is invalid or inactive');

    const localDate = this.londonDate(); const weekStart = this.mondayOf(localDate);
    this.validateSubmission(dto);
    const checklist = dto.type === VehicleCheckType.Daily ? this.normaliseDaily(dto) : [];
    const defects = checklist.filter((item) => item.result === VehicleChecklistResult.Minor || item.result === VehicleChecklistResult.Dangerous);
    const weeklyPhotos = (dto.weeklyPhotos ?? []).map((photo) => ({
      key: photo.key,
      label: WEEKLY_PHOTO_LABELS[photo.key],
      url: photo.url,
      required: REQUIRED_WEEKLY_PHOTOS.includes(photo.key),
    }));
    const body: any = { vehicleId: vehicle._id, engineerId: engineer._id, type: dto.type, localDate, weekStart: dto.type === VehicleCheckType.Weekly ? weekStart : null, odometerMiles: dto.odometerMiles ?? null, fuelLevel: dto.fuelLevel ?? null, dashboardPhotoUrl: dto.dashboardPhotoUrl ?? null, checklist, weeklyPhotos, conditionNote: dto.conditionNote?.trim() || null, signatureUrl: dto.signatureUrl ?? null, engineerConfirmed: true, defectCount: defects.length, dangerousDefectCount: defects.filter((item) => item.result === VehicleChecklistResult.Dangerous).length, status: defects.length ? VehicleCheckStatus.Open : VehicleCheckStatus.Completed, submittedAt: new Date() };
    try { return await this.checks.create(body); }
    catch (error: any) { if (error?.code === 11000) throw new ConflictException(`A ${dto.type.toLowerCase()} check is already submitted for this vehicle on this due period`); throw error; }
  }

  async list(query: VehicleChecksQueryDto) { return this.paginate(this.filters(query), query); }
  async detail(id: string) { return this.findOne(id); }
  async acknowledge(id: string, adminId: string) {
    const check = await this.findOne(id);
    if (check.status !== VehicleCheckStatus.Open) throw new BadRequestException('Only open defects can be acknowledged');
    return this.checks.findByIdAndUpdate(id, { status: VehicleCheckStatus.Acknowledged, acknowledgedBy: new Types.ObjectId(adminId), acknowledgedAt: new Date() }, { new: true }).exec();
  }
  async resolve(id: string, adminId: string, dto: ResolveVehicleDefectDto) {
    const check = await this.findOne(id);
    if (![VehicleCheckStatus.Open, VehicleCheckStatus.Acknowledged].includes(check.status)) throw new BadRequestException('Only open or acknowledged defects can be resolved');
    return this.checks.findByIdAndUpdate(id, { status: VehicleCheckStatus.Resolved, resolvedBy: new Types.ObjectId(adminId), resolvedAt: new Date(), resolutionNote: dto.resolutionNote.trim() }, { new: true }).exec();
  }
  async overdueSummary() {
    const localDate = this.londonDate(); const weekStart = this.mondayOf(localDate);
    const active = await this.vehicles.find({ isActive: true, assignedEngineerId: { $ne: null } }).lean().exec();
    const rows = await Promise.all(active.map(async (vehicle: any) => {
      const daily = await this.checks.exists({ vehicleId: vehicle._id, engineerId: vehicle.assignedEngineerId, type: VehicleCheckType.Daily, localDate });
      const weekly = await this.checks.exists({ vehicleId: vehicle._id, engineerId: vehicle.assignedEngineerId, type: VehicleCheckType.Weekly, weekStart });
      const engineer = await this.engineers.findById(vehicle.assignedEngineerId).select('fullName').lean().exec();
      return { vehicleId: vehicle._id.toString(), registrationNumber: vehicle.registrationNumber, engineer: engineer?.fullName ?? 'Unknown', dailyOverdue: !daily, weeklyOverdue: localDate >= weekStart && !weekly };
    }));
    return { timezone: 'Europe/London', localDate, weekStart, alerts: rows.filter((row) => row.dailyOverdue || row.weeklyOverdue), total: rows.filter((row) => row.dailyOverdue || row.weeklyOverdue).length };
  }

  private validateSubmission(dto: SubmitVehicleCheckDto) {
    if (!dto.engineerConfirmed) throw new BadRequestException('Confirmation is required');
    const urls = [dto.dashboardPhotoUrl, dto.signatureUrl, ...(dto.weeklyPhotos ?? []).map((photo) => photo.url), ...(dto.checklist ?? []).flatMap((item) => item.photoUrls ?? [])].filter(Boolean) as string[];
    if (urls.some((url) => !url.startsWith('https://res.cloudinary.com/'))) throw new BadRequestException('Check images must be uploaded through the vehicle-check upload endpoint');
    if (dto.type === VehicleCheckType.Daily) {
      if (dto.odometerMiles === undefined || !dto.fuelLevel || !dto.dashboardPhotoUrl || !dto.signatureUrl) throw new BadRequestException('Odometer, fuel level, dashboard photo, signature, and confirmation are required');
      if (!dto.checklist?.length) throw new BadRequestException('Complete every daily checklist item');
    } else {
      const keys = new Set((dto.weeklyPhotos ?? []).map((photo) => photo.key));
      if ((dto.weeklyPhotos ?? []).some((photo) => !WEEKLY_PHOTO_LABELS[photo.key])) throw new BadRequestException('Invalid weekly photo slot');
      const missing = REQUIRED_WEEKLY_PHOTOS.filter((key) => !keys.has(key));
      if (missing.length) throw new BadRequestException(`Required weekly photos are missing: ${missing.join(', ')}`);
    }
  }
  private normaliseDaily(dto: SubmitVehicleCheckDto) {
    const supplied = new Map((dto.checklist ?? []).map((item) => [item.key, item]));
    const unknown = [...supplied.keys()].filter((key) => !DAILY_ITEMS.some(([valid]) => valid === key));
    if (unknown.length) throw new BadRequestException('Invalid daily checklist item');
    return DAILY_ITEMS.map(([key, label, section]) => {
      const item = supplied.get(key);
      if (!item) throw new BadRequestException(`Complete ${label}`);
      const defect = item.result === VehicleChecklistResult.Minor || item.result === VehicleChecklistResult.Dangerous;
      if (defect && !item.note?.trim()) throw new BadRequestException(`Add a note for the defect: ${label}`);
      return { key, label, section, result: item.result, note: item.note?.trim() || null, photoUrls: item.photoUrls ?? [] };
    });
  }
  private filters(query: VehicleChecksQueryDto) {
    const filter: any = {};
    if (query.type) filter.type = query.type; if (query.status) filter.status = query.status;
    if (query.vehicleId && Types.ObjectId.isValid(query.vehicleId)) filter.vehicleId = new Types.ObjectId(query.vehicleId);
    if (query.engineerId && Types.ObjectId.isValid(query.engineerId)) filter.engineerId = new Types.ObjectId(query.engineerId);
    if (query.dateFrom || query.dateTo) filter.localDate = { ...(query.dateFrom ? { $gte: query.dateFrom } : {}), ...(query.dateTo ? { $lte: query.dateTo } : {}) };
    if (query.defectSeverity === 'DANGEROUS') filter.dangerousDefectCount = { $gt: 0 }; if (query.defectSeverity === 'MINOR') filter.defectCount = { $gt: 0 };
    return filter;
  }
  private async paginate(filter: any, query: VehicleChecksQueryDto) { const page = query.page ?? 1; const limit = Math.min(query.limit ?? 20, 100); const [items, total] = await Promise.all([this.checks.find(filter).populate('vehicleId', 'registrationNumber').populate('engineerId', 'fullName workEmail').sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(), this.checks.countDocuments(filter)]); return { items, total, page, limit }; }
  private async findOne(id: string, additional: any = {}) { if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Vehicle check not found'); const check = await this.checks.findOne({ _id: id, ...additional }).populate('vehicleId', 'registrationNumber').populate('engineerId', 'fullName workEmail').lean().exec(); if (!check) throw new NotFoundException('Vehicle check not found'); return check; }
  private async getEngineer(userId: string) { const user = await this.users.findById(userId).select('email').lean().exec(); const engineer = user ? await this.engineers.findOne({ workEmail: user.email }).select('_id fullName').lean().exec() : null; if (!engineer) throw new ForbiddenException('No engineer profile is associated with this account'); return engineer; }
  private londonDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
  private mondayOf(localDate: string) { const [year, month, day] = localDate.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day)); const offset = (date.getUTCDay() + 6) % 7; date.setUTCDate(date.getUTCDate() - offset); return date.toISOString().slice(0, 10); }
}
