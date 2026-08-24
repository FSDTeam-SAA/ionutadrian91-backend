import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser, RateCard, RateCardDocument, TeamMember, Timesheet, TimesheetDocument, TimesheetStatus } from '../../common/schemas';
import { CreateRateCardDto, UpdateRateCardDto } from './dto/rate-card.dto';
import { CreateTimesheetDto, ListTimesheetsQueryDto } from './dto/timesheet.dto';

@Injectable()
export class TimesheetsService {
  constructor(@InjectModel(RateCard.name) private readonly rateCards: Model<RateCardDocument>, @InjectModel(Timesheet.name) private readonly timesheets: Model<TimesheetDocument>, @InjectModel(TeamMember.name) private readonly members: Model<any>, @InjectModel(AuthUser.name) private readonly users: Model<any>) {}

  async listRateCards(search = '', isActive?: string) {
    const filter: any = {};
    if (search) filter.$text = { $search: search };
    if (isActive === 'true' || isActive === 'false') filter.isActive = isActive === 'true';
    return this.rateCards.find(filter).sort(search ? { score: { $meta: 'textScore' } } : { code: 1 }).lean();
  }
  async createRateCard(dto: CreateRateCardDto) { try { return await this.rateCards.create({ ...dto, code: dto.code.trim().toUpperCase() }); } catch (e: any) { if (e?.code === 11000) throw new BadRequestException('Rate code already exists'); throw e; } }
  async updateRateCard(id: string, dto: UpdateRateCardDto) { const card = await this.rateCards.findByIdAndUpdate(id, dto, { new: true }).exec(); if (!card) throw new NotFoundException('Rate card not found'); return card; }
  async removeRateCard(id: string) { const card = await this.rateCards.findById(id).exec(); if (!card) throw new NotFoundException('Rate card not found'); const used = await this.timesheets.exists({ 'items.rateCode': card.code }); if (used) { card.isActive = false; await card.save(); return { deactivated: true }; } await card.deleteOne(); return { deleted: true }; }

  async createForEngineer(userId: string, dto: CreateTimesheetDto) {
    const primaryEngineerId = await this.engineerForUser(userId);
    const engineerIds = [primaryEngineerId];
    const data = await this.timesheetData(dto);
    return this.timesheets.create({ ...data, engineerIds, status: TimesheetStatus.DRAFT });
  }
  async listOwn(userId: string, query: ListTimesheetsQueryDto) { return this.list(query, await this.engineerForUser(userId)); }
  async findOwn(userId: string, id: string) {
    const engineerId = await this.engineerForUser(userId);
    const item = await this.findDocument(id);
    if (!item.engineerIds.some((member: Types.ObjectId) => member.toString() === engineerId.toString())) throw new NotFoundException('Timesheet not found');
    return this.response((await this.timesheets.findById(id).populate('engineerIds', 'fullName').lean())!);
  }
  async updateOwn(userId: string, id: string, dto: CreateTimesheetDto) {
    const engineerId = await this.engineerForUser(userId);
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Timesheet not found');
    const item = await this.timesheets.findOneAndUpdate({ _id: id, engineerIds: engineerId, status: { $in: [TimesheetStatus.DRAFT, TimesheetStatus.REJECTED] } }, { $set: await this.timesheetData(dto) }, { new: true }).exec();
    if (!item) throw new BadRequestException('Only your draft or rejected timesheets can be edited');
    return this.findOwn(userId, id);
  }
  async submitOwn(userId: string, id: string) {
    const engineerId = await this.engineerForUser(userId);
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Timesheet not found');
    const item = await this.timesheets.findOneAndUpdate({ _id: id, engineerIds: engineerId, status: { $in: [TimesheetStatus.DRAFT, TimesheetStatus.REJECTED] } }, { $set: { status: TimesheetStatus.SUBMITTED, submittedAt: new Date(), rejectionReason: null, reviewedAt: null, reviewedBy: null } }, { new: true }).exec();
    if (!item) throw new BadRequestException('Only your draft or rejected timesheets can be submitted');
    return this.findOwn(userId, id);
  }
  private async timesheetData(dto: CreateTimesheetDto) {
    const normalizedCodes = dto.items.map((item) => item.rateCode.trim().toUpperCase());
    if (new Set(normalizedCodes).size !== normalizedCodes.length) throw new BadRequestException('A rate code can only be used once per timesheet');
    const codes = normalizedCodes;
    const cards = await this.rateCards.find({ code: { $in: codes }, isActive: true }).lean();
    if (cards.length !== codes.length) throw new BadRequestException('One or more rate codes are invalid or inactive');
    const byCode = new Map(cards.map((card) => [card.code, card]));
    const items = dto.items.map((item) => { const card = byCode.get(item.rateCode.trim().toUpperCase())!; const total = Number((card.price * item.quantity).toFixed(2)); if (!Number.isFinite(total) || total > 1_000_000_000_000) throw new BadRequestException('Work item total is out of range'); return { rateCode: card.code, description: card.description, unit: card.unit, unitPrice: card.price, quantity: item.quantity, total, buildStatus: item.buildStatus ?? null, comments: item.comments ?? null }; });
    const totalValue = Number(items.reduce((sum, item) => sum + item.total, 0).toFixed(2));
    if (!Number.isFinite(totalValue) || totalValue > 1_000_000_000_000) throw new BadRequestException('Timesheet total is out of range');
    return { claimDate: new Date(dto.claimDate), townCity: dto.townCity.trim(), jobNumber: dto.jobNumber.trim().toUpperCase(), polygonType: dto.polygonType.trim(), polygonId: dto.polygonId.trim(), featureId: dto.featureId.trim(), items, totalValue };
  }
  async list(query: ListTimesheetsQueryDto, ownEngineerId?: Types.ObjectId) {
    const filter: any = {};
    if (ownEngineerId) filter.engineerIds = ownEngineerId;
    else if (query.engineerId) filter.engineerIds = new Types.ObjectId(query.engineerId);
    if (query.status) filter.status = query.status;
    if (query.rateCode) filter['items.rateCode'] = query.rateCode.trim().toUpperCase();
    if (query.townCity) filter.townCity = { $regex: escapeRegex(query.townCity), $options: 'i' };
    if (query.jobNumber) filter.jobNumber = { $regex: escapeRegex(query.jobNumber), $options: 'i' };
    if (query.dateFrom || query.dateTo) filter.claimDate = { ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { $lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}) };
    if (query.search) {
      const engineerIds = (await this.members.find({ fullName: { $regex: escapeRegex(query.search), $options: 'i' } }).select('_id').lean()).map((member: any) => member._id);
      filter.$or = [{ $text: { $search: query.search } }, ...(engineerIds.length ? [{ engineerIds: { $in: engineerIds } }] : [])];
    }
    const [items, total] = await Promise.all([this.timesheets.find(filter).populate('engineerIds', 'fullName').sort(query.search ? { score: { $meta: 'textScore' } } : { createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(), this.timesheets.countDocuments(filter)]);
    return { data: items.map((item: any) => this.response(item)), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }
  async findOne(id: string) { if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Timesheet not found'); const item = await this.timesheets.findById(id).populate('engineerIds', 'fullName').lean(); if (!item) throw new NotFoundException('Timesheet not found'); return this.response(item); }
  async updateStatus(id: string, status: TimesheetStatus, reviewerId: string, rejectionReason?: string) { const reason = rejectionReason?.trim(); if (![TimesheetStatus.APPROVED, TimesheetStatus.REJECTED].includes(status)) throw new BadRequestException('Timesheets can only be approved or rejected'); if (status === TimesheetStatus.REJECTED && !reason) throw new BadRequestException('A rejection reason is required'); if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Timesheet not found'); const item = await this.timesheets.findOneAndUpdate({ _id: id, status: TimesheetStatus.SUBMITTED }, { $set: { status, reviewedAt: new Date(), reviewedBy: new Types.ObjectId(reviewerId), rejectionReason: status === TimesheetStatus.REJECTED ? reason ?? null : null } }, { new: true }).exec(); if (!item) throw new BadRequestException('Only submitted timesheets can be reviewed'); return this.findOne(id); }
  private async findDocument(id: string) { if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Timesheet not found'); const item = await this.timesheets.findById(id).exec(); if (!item) throw new NotFoundException('Timesheet not found'); return item; }
  private async engineerForUser(userId: string) { const user = await this.users.findById(userId).select('email').lean(); const member = user ? await this.members.findOne({ workEmail: user.email, employeeCategory: 'ENGINEER' }).select('_id').lean() : null; if (!member) throw new BadRequestException('No engineer profile is associated with this account'); return member._id; }
  private response(item: any) { return { ...item, id: item._id.toString(), _id: undefined, engineerIds: item.engineerIds?.map((engineer: any) => typeof engineer === 'object' && engineer.fullName ? { id: engineer._id.toString(), name: engineer.fullName } : engineer.toString()) }; }
}

function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
