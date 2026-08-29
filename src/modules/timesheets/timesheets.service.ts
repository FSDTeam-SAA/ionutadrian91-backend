import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuthUser,
  RateCard,
  RateCardDocument,
  TeamMember,
  Timesheet,
  TimesheetDocument,
  TimesheetStatus,
  TimesheetUnlockRequest,
  TimesheetUnlockRequestDocument,
  TimesheetUnlockRequestStatus,
  TimesheetWorkStatus,
  Whereabouts,
} from '../../common/schemas';
import { CreateRateCardDto, UpdateRateCardDto } from './dto/rate-card.dto';
import {
  CreateTimesheetDto,
  CreateTimesheetUnlockRequestDto,
  ListTimesheetsQueryDto,
} from './dto/timesheet.dto';

@Injectable()
export class TimesheetsService {
  constructor(
    @InjectModel(RateCard.name)
    private readonly rateCards: Model<RateCardDocument>,
    @InjectModel(Timesheet.name)
    private readonly timesheets: Model<TimesheetDocument>,
    @InjectModel(TeamMember.name) private readonly members: Model<any>,
    @InjectModel(AuthUser.name) private readonly users: Model<any>,
    @InjectModel(Whereabouts.name) private readonly assignments: Model<any>,
    @InjectModel(TimesheetUnlockRequest.name)
    private readonly unlockRequests: Model<TimesheetUnlockRequestDocument>,
  ) {}

  async listRateCards(search = '', isActive?: string) {
    const filter: any = {};
    if (search) filter.$text = { $search: search };
    if (isActive === 'true' || isActive === 'false')
      filter.isActive = isActive === 'true';
    return this.rateCards
      .find(filter)
      .sort(search ? { score: { $meta: 'textScore' } } : { code: 1 })
      .lean();
  }
  async createRateCard(dto: CreateRateCardDto) {
    try {
      return await this.rateCards.create({
        ...dto,
        code: dto.code.trim().toUpperCase(),
      });
    } catch (error: any) {
      if (error?.code === 11000)
        throw new BadRequestException('Rate code already exists');
      throw error;
    }
  }
  async updateRateCard(id: string, dto: UpdateRateCardDto) {
    const card = await this.rateCards
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!card) throw new NotFoundException('Rate card not found');
    return card;
  }
  async removeRateCard(id: string) {
    const card = await this.rateCards.findById(id).exec();
    if (!card) throw new NotFoundException('Rate card not found');
    const used = await this.timesheets.exists({ 'items.rateCode': card.code });
    if (used) {
      card.isActive = false;
      await card.save();
      return { deactivated: true };
    }
    await card.deleteOne();
    return { deleted: true };
  }

  async eligibleOwn(userId: string, claimDate?: string) {
    const engineerId = await this.engineerForUser(userId);
    const date = this.localDate(claimDate ?? this.today());
    const assignments = await this.assignments
      .find({
        $or: [{ engineers: engineerId }, { workers: engineerId }],
        startDate: { $lte: this.endOfDay(date) },
        endDate: { $gte: date },
      })
      .populate('projectId', 'name status')
      .populate('engineers', 'fullName')
      .populate('workers', 'fullName')
      .lean();
    const sheets = await this.timesheets
      .find({ engineerId, claimDate: date })
      .lean();
    const byAssignment = new Map(
      sheets.map((sheet: any) => [sheet.assignmentId?.toString(), sheet]),
    );
    return Promise.all(
      assignments.map(async (assignment: any) => {
        const assignmentId = assignment._id.toString();
        const sheet = byAssignment.get(assignmentId);
        const team = [
          ...(assignment.engineers ?? []),
          ...(assignment.workers ?? []),
        ].map((member: any) => ({
          id: member._id.toString(),
          name: member.fullName,
        }));
        const teamIds = team.map((member) => new Types.ObjectId(member.id));
        const teamSheets = await this.timesheets
          .find({
            assignmentId: assignment._id,
            claimDate: date,
            engineerId: { $in: teamIds },
          })
          .populate('engineerId', 'fullName')
          .lean();
        const summaries = await Promise.all(
          teamSheets.map((teamSheet: any) => this.response(teamSheet)),
        );
        const summaryByEngineer = new Map(
          summaries.map((summary: any) => [summary.engineerId, summary]),
        );
        const teamTimesheets = team.map((member) => {
          const summary = summaryByEngineer.get(member.id);
          const isOwnSheet = member.id === engineerId.toString();
          // A draft remains private to its author; submitted/reviewed status is visible to the assigned team.
          if (
            !summary ||
            (!isOwnSheet && summary.status === TimesheetStatus.DRAFT)
          )
            return {
              engineer: member,
              status: 'NOT_SUBMITTED',
              workStatus: null,
              jobNumber: null,
              contributedValue: 0,
              payableShare: 0,
              rejectionReason: null,
              isOwn: isOwnSheet,
            };
          return {
            engineer: member,
            status: summary.status,
            workStatus: summary.workStatus,
            jobNumber: summary.jobNumber || null,
            contributedValue: summary.totalValue,
            payableShare: summary.payableShare,
            rejectionReason:
              summary.status === TimesheetStatus.REJECTED
                ? summary.rejectionReason
                : null,
            isOwn: isOwnSheet,
          };
        });
        const unlock =
          date < this.localDate(this.today())
            ? await this.unlockRequests
                .findOne({
                  assignmentId: assignment._id,
                  projectId: assignment.projectId._id,
                  engineerId,
                  claimDate: date,
                  status: TimesheetUnlockRequestStatus.APPROVED,
                })
                .lean()
            : null;
        return {
          assignmentId,
          project: {
            id: assignment.projectId._id.toString(),
            name: assignment.projectId.name,
          },
          claimDate: this.dateOnly(date),
          team,
          teamTimesheets,
          canSubmit:
            Boolean(sheet) ||
            date >= this.localDate(this.today()) ||
            Boolean(unlock),
          requiresUnlock:
            !sheet && date < this.localDate(this.today()) && !unlock,
          timesheet: sheet ? await this.response(sheet) : null,
        };
      }),
    );
  }
  async listEngineers() {
    const engineers = await this.members
      .find({ employeeCategory: 'ENGINEER' })
      .select('fullName workEmail')
      .sort({ fullName: 1 })
      .lean();
    return engineers.map((eng: any) => ({
      id: eng._id.toString(),
      name: eng.fullName,
      email: eng.workEmail,
    }));
  }

  async addTeamMember(userId: string, assignmentId: string, memberId: string) {
    const engineerId = await this.engineerForUser(userId);
    const assignment = await this.assignments.findById(assignmentId).exec();
    if (!assignment) throw new NotFoundException('Assignment not found');
    const isAssigned = [
      ...(assignment.engineers ?? []),
      ...(assignment.workers ?? []),
    ].some((member: any) => this.sameId(member, engineerId));
    if (!isAssigned)
      throw new BadRequestException('You are not assigned to this project');
    if (!Types.ObjectId.isValid(memberId))
      throw new BadRequestException('Invalid member ID');
    const isMemberAssigned = [
      ...(assignment.engineers ?? []),
      ...(assignment.workers ?? []),
    ].some((member: any) => this.sameId(member, memberId));
    if (!isMemberAssigned) {
      assignment.engineers.push(new Types.ObjectId(memberId));
      await assignment.save();
    }
    return { success: true };
  }

  async removeTeamMember(
    userId: string,
    assignmentId: string,
    memberId: string,
  ) {
    const engineerId = await this.engineerForUser(userId);
    const assignment = await this.assignments.findById(assignmentId).exec();
    if (!assignment) throw new NotFoundException('Assignment not found');
    const isAssigned = [
      ...(assignment.engineers ?? []),
      ...(assignment.workers ?? []),
    ].some((member: any) => this.sameId(member, engineerId));
    if (!isAssigned)
      throw new BadRequestException('You are not assigned to this project');
    if (!Types.ObjectId.isValid(memberId))
      throw new BadRequestException('Invalid member ID');
    if (this.sameId(engineerId, memberId))
      throw new BadRequestException(
        'You cannot remove yourself from the assignment',
      );
    assignment.engineers = (assignment.engineers ?? []).filter(
      (id: any) => !this.sameId(id, memberId),
    );
    assignment.workers = (assignment.workers ?? []).filter(
      (id: any) => !this.sameId(id, memberId),
    );
    await assignment.save();
    return { success: true };
  }

  async createForEngineer(userId: string, dto: CreateTimesheetDto) {
    const engineerId = await this.engineerForUser(userId);
    const claimDate = this.localDate(dto.claimDate);
    await this.assertSubmissionAllowed(
      engineerId,
      dto.projectId,
      dto.assignmentId,
      claimDate,
    );
    const data = await this.timesheetData(dto);
    try {
      const sheet = await this.timesheets.create({
        ...data,
        claimDate,
        projectId: new Types.ObjectId(dto.projectId),
        assignmentId: new Types.ObjectId(dto.assignmentId),
        engineerId,
        engineerIds: [engineerId],
        status: TimesheetStatus.DRAFT,
      });
      return this.response(sheet.toObject());
    } catch (error: any) {
      if (error?.code === 11000)
        throw new BadRequestException(
          'You already have a timesheet for this project and date',
        );
      throw error;
    }
  }
  async listOwn(userId: string, query: ListTimesheetsQueryDto) {
    return this.list(query, await this.engineerForUser(userId));
  }
  async findOwn(userId: string, id: string) {
    const engineerId = await this.engineerForUser(userId);
    const item = await this.findDocument(id);
    if (!this.sameId(item.engineerId, engineerId))
      throw new NotFoundException('Timesheet not found');
    return this.response(item.toObject());
  }
  async updateOwn(userId: string, id: string, dto: CreateTimesheetDto) {
    const engineerId = await this.engineerForUser(userId);
    const existing = await this.findDocument(id);
    if (!this.sameId(existing.engineerId, engineerId))
      throw new NotFoundException('Timesheet not found');
    if (
      ![TimesheetStatus.DRAFT, TimesheetStatus.REJECTED].includes(
        existing.status,
      )
    )
      throw new BadRequestException(
        'Only draft or rejected timesheets can be edited',
      );
    const claimDate = this.localDate(dto.claimDate);
    if (
      !this.sameId(existing.projectId, dto.projectId) ||
      !this.sameId(existing.assignmentId, dto.assignmentId) ||
      existing.claimDate.getTime() !== claimDate.getTime()
    )
      throw new BadRequestException(
        'Project, assignment, and date cannot be changed after creation',
      );
    await this.assertSubmissionAllowed(
      engineerId,
      dto.projectId,
      dto.assignmentId,
      claimDate,
    );
    const item = await this.timesheets
      .findByIdAndUpdate(
        id,
        { $set: await this.timesheetData(dto) },
        { new: true },
      )
      .exec();
    return this.response(item!.toObject());
  }
  async submitOwn(userId: string, id: string) {
    const engineerId = await this.engineerForUser(userId);
    const item = await this.timesheets
      .findOneAndUpdate(
        {
          _id: id,
          engineerId,
          status: { $in: [TimesheetStatus.DRAFT, TimesheetStatus.REJECTED] },
        },
        {
          $set: {
            status: TimesheetStatus.SUBMITTED,
            submittedAt: new Date(),
            rejectionReason: null,
            reviewedAt: null,
            reviewedBy: null,
          },
        },
        { new: true },
      )
      .exec();
    if (!item)
      throw new BadRequestException(
        'Only your draft or rejected timesheets can be submitted',
      );
    return this.response(item.toObject());
  }

  async list(query: ListTimesheetsQueryDto, ownEngineerId?: Types.ObjectId) {
    const filter: any = {};
    if (ownEngineerId) filter.engineerId = ownEngineerId;
    else if (query.engineerId)
      filter.engineerId = new Types.ObjectId(query.engineerId);
    if (query.projectId) filter.projectId = new Types.ObjectId(query.projectId);
    if (query.assignmentId)
      filter.assignmentId = new Types.ObjectId(query.assignmentId);
    if (query.status) filter.status = query.status;
    if (query.workStatus) filter.workStatus = query.workStatus;
    if (query.rateCode)
      filter['items.rateCode'] = query.rateCode.trim().toUpperCase();
    if (query.townCity)
      filter.townCity = { $regex: escapeRegex(query.townCity), $options: 'i' };
    if (query.jobNumber)
      filter.jobNumber = {
        $regex: escapeRegex(query.jobNumber),
        $options: 'i',
      };
    if (query.dateFrom || query.dateTo)
      filter.claimDate = {
        ...(query.dateFrom ? { $gte: this.localDate(query.dateFrom) } : {}),
        ...(query.dateTo
          ? { $lte: this.endOfDay(this.localDate(query.dateTo)) }
          : {}),
      };
    if (query.search) filter.$text = { $search: query.search };
    const [items, total] = await Promise.all([
      this.timesheets
        .find(filter)
        .populate('engineerId', 'fullName')
        .populate('projectId', 'name')
        .sort({ claimDate: -1, createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.timesheets.countDocuments(filter),
    ]);
    return {
      data: await Promise.all(items.map((item: any) => this.response(item))),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
  async findOne(id: string) {
    return this.response((await this.findDocument(id)).toObject());
  }
  async updateStatus(
    id: string,
    status: TimesheetStatus,
    reviewerId: string,
    rejectionReason?: string,
  ) {
    const reason = rejectionReason?.trim();
    if (![TimesheetStatus.APPROVED, TimesheetStatus.REJECTED].includes(status))
      throw new BadRequestException(
        'Timesheets can only be approved or rejected',
      );
    if (status === TimesheetStatus.REJECTED && !reason)
      throw new BadRequestException('A rejection reason is required');
    const item = await this.timesheets
      .findOneAndUpdate(
        { _id: id, status: TimesheetStatus.SUBMITTED },
        {
          $set: {
            status,
            reviewedAt: new Date(),
            reviewedBy: new Types.ObjectId(reviewerId),
            rejectionReason:
              status === TimesheetStatus.REJECTED ? reason : null,
          },
        },
        { new: true },
      )
      .exec();
    if (!item)
      throw new BadRequestException(
        'Only submitted timesheets can be reviewed',
      );
    return this.response(item.toObject());
  }

  async requestUnlock(userId: string, dto: CreateTimesheetUnlockRequestDto) {
    const engineerId = await this.engineerForUser(userId);
    const claimDate = this.localDate(dto.claimDate);
    if (claimDate >= this.localDate(this.today()))
      throw new BadRequestException(
        'Only past dates require an unlock request',
      );
    await this.assertAssignment(
      engineerId,
      dto.projectId,
      dto.assignmentId,
      claimDate,
    );
    const exists = await this.unlockRequests.exists({
      projectId: dto.projectId,
      assignmentId: dto.assignmentId,
      engineerId,
      claimDate,
      status: {
        $in: [
          TimesheetUnlockRequestStatus.PENDING,
          TimesheetUnlockRequestStatus.APPROVED,
        ],
      },
    });
    if (exists)
      throw new BadRequestException(
        'An unlock request already exists for this project and date',
      );
    return this.unlockRequests.create({
      ...dto,
      projectId: new Types.ObjectId(dto.projectId),
      assignmentId: new Types.ObjectId(dto.assignmentId),
      engineerId,
      claimDate,
      reason: dto.reason?.trim() || null,
    });
  }
  async listUnlockRequests(status?: TimesheetUnlockRequestStatus) {
    return this.unlockRequests
      .find(status ? { status } : {})
      .populate('projectId', 'name')
      .populate('engineerId', 'fullName')
      .sort({ createdAt: -1 })
      .lean();
  }
  async reviewUnlockRequest(
    id: string,
    status: TimesheetUnlockRequestStatus,
    reviewerId: string,
  ) {
    if (
      ![
        TimesheetUnlockRequestStatus.APPROVED,
        TimesheetUnlockRequestStatus.REJECTED,
      ].includes(status)
    )
      throw new BadRequestException(
        'Unlock requests can only be approved or rejected',
      );
    const request = await this.unlockRequests
      .findOneAndUpdate(
        { _id: id, status: TimesheetUnlockRequestStatus.PENDING },
        {
          $set: {
            status,
            reviewedBy: new Types.ObjectId(reviewerId),
            reviewedAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();
    if (!request)
      throw new BadRequestException(
        'Only pending unlock requests can be reviewed',
      );
    return request;
  }

  private async timesheetData(dto: CreateTimesheetDto) {
    const base = {
      townCity: dto.townCity?.trim() ?? '',
      jobNumber: dto.jobNumber?.trim().toUpperCase() ?? '',
      polygonType: dto.polygonType?.trim() ?? '',
      polygonId: dto.polygonId?.trim() ?? '',
      featureId: dto.featureId?.trim() ?? '',
    };
    if (dto.workStatus === TimesheetWorkStatus.OFF_DAY) {
      if (dto.items?.length)
        throw new BadRequestException(
          'Off-day timesheets cannot contain work items',
        );
      return {
        ...base,
        workStatus: TimesheetWorkStatus.OFF_DAY,
        items: [],
        totalValue: 0,
      };
    }
    if (!dto.items?.length)
      throw new BadRequestException(
        'Working timesheets require at least one work item',
      );
    const codes = dto.items.map((item) => item.rateCode.trim().toUpperCase());
    if (new Set(codes).size !== codes.length)
      throw new BadRequestException(
        'A rate code can only be used once per timesheet',
      );
    const cards = await this.rateCards
      .find({ code: { $in: codes }, isActive: true })
      .lean();
    if (cards.length !== codes.length)
      throw new BadRequestException(
        'One or more rate codes are invalid or inactive',
      );
    const byCode = new Map(cards.map((card) => [card.code, card]));
    const items = dto.items.map((item) => {
      const card = byCode.get(item.rateCode.trim().toUpperCase())!;
      const total = Number((card.price * item.quantity).toFixed(2));
      return {
        rateCode: card.code,
        description: card.description,
        unit: card.unit,
        unitPrice: card.price,
        quantity: item.quantity,
        total,
        buildStatus: item.buildStatus ?? null,
        comments: item.comments ?? null,
      };
    });
    return {
      ...base,
      workStatus: TimesheetWorkStatus.WORKING,
      items,
      totalValue: Number(
        items.reduce((sum, item) => sum + item.total, 0).toFixed(2),
      ),
    };
  }
  private async assertSubmissionAllowed(
    engineerId: Types.ObjectId,
    projectId: string,
    assignmentId: string,
    claimDate: Date,
  ) {
    await this.assertAssignment(engineerId, projectId, assignmentId, claimDate);
    if (claimDate < this.localDate(this.today())) {
      const unlocked = await this.unlockRequests.exists({
        projectId,
        assignmentId,
        engineerId,
        claimDate,
        status: TimesheetUnlockRequestStatus.APPROVED,
      });
      if (!unlocked)
        throw new BadRequestException(
          'Past dates are locked. Request an admin unlock first.',
        );
    }
  }
  private async assertAssignment(
    engineerId: Types.ObjectId,
    projectId: string,
    assignmentId: string,
    claimDate: Date,
  ) {
    const assignment = await this.assignments.findById(assignmentId).lean();
    const assignedMembers = [
      ...(assignment?.engineers ?? []),
      ...(assignment?.workers ?? []),
    ];
    const isAssigned = assignedMembers.some((member: any) =>
      this.sameId(member, engineerId),
    );
    const occursOnDate =
      assignment &&
      assignment.startDate <= this.endOfDay(claimDate) &&
      assignment.endDate >= claimDate;
    if (
      !assignment ||
      !this.sameId(assignment.projectId, projectId) ||
      !isAssigned ||
      !occursOnDate
    )
      throw new BadRequestException(
        'You are not assigned to this project on the selected date',
      );
  }
  private async response(item: any) {
    const base = item.toObject ? item.toObject() : item;
    const projectId =
      base.projectId?._id?.toString?.() ?? base.projectId?.toString?.() ?? null;
    const assignmentId =
      base.assignmentId?._id?.toString?.() ??
      base.assignmentId?.toString?.() ??
      null;
    const engineerId =
      base.engineerId?._id?.toString?.() ??
      base.engineerId?.toString?.() ??
      null;
    let projectDailyTotal = base.totalValue;
    let workingEngineerCount =
      base.workStatus === TimesheetWorkStatus.WORKING ? 1 : 0;
    if (projectId && assignmentId && engineerId) {
      const query: any = {
        projectId: new Types.ObjectId(projectId),
        claimDate: this.localDate(base.claimDate),
        workStatus: TimesheetWorkStatus.WORKING,
        status: { $in: [TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED] },
      };
      if (base.jobNumber) query.jobNumber = base.jobNumber;
      const group = await this.timesheets
        .find(query)
        .select('totalValue')
        .lean();
      projectDailyTotal = Number(
        group
          .reduce((sum: number, sheet: any) => sum + sheet.totalValue, 0)
          .toFixed(2),
      );
      workingEngineerCount = group.length;
    }
    const payableShare =
      base.workStatus === TimesheetWorkStatus.OFF_DAY || !workingEngineerCount
        ? 0
        : Number((projectDailyTotal / workingEngineerCount).toFixed(2));
    return {
      ...base,
      id: base._id?.toString?.() ?? base.id,
      _id: undefined,
      projectId,
      assignmentId,
      engineerId,
      engineer:
        base.engineerId &&
        typeof base.engineerId === 'object' &&
        base.engineerId.fullName
          ? { id: engineerId, name: base.engineerId.fullName }
          : engineerId,
      project:
        base.projectId &&
        typeof base.projectId === 'object' &&
        base.projectId.name
          ? { id: projectId, name: base.projectId.name }
          : projectId,
      projectDailyTotal,
      workingEngineerCount,
      payableShare,
    };
  }
  private async findDocument(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Timesheet not found');
    const item = await this.timesheets.findById(id).exec();
    if (!item) throw new NotFoundException('Timesheet not found');
    return item;
  }
  private async engineerForUser(userId: string) {
    const user = await this.users.findById(userId).select('email').lean();
    const member = user
      ? await this.members
          .findOne({ workEmail: user.email, employeeCategory: 'ENGINEER' })
          .select('_id')
          .lean()
      : null;
    if (!member)
      throw new BadRequestException(
        'No engineer profile is associated with this account',
      );
    return member._id;
  }
  private localDate(value: string | Date) {
    const date = new Date(value);
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }
  private endOfDay(value: Date) {
    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
  }
  private today() {
    return new Date().toISOString().slice(0, 10);
  }
  private dateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }
  private sameId(left: any, right: any) {
    return (
      left?.toString?.() === right?.toString?.() ||
      left?.toString?.() === String(right)
    );
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
