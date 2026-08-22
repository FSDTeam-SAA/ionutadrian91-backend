import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job, JobDocument, TeamMember, Project } from '../../common/schemas';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@Injectable()
export class JobsService {
  constructor(@InjectModel(Job.name) private readonly jobs: Model<JobDocument>, @InjectModel(Project.name) private readonly projects: Model<any>, @InjectModel(TeamMember.name) private readonly members: Model<any>) {}

  async create(dto: CreateJobDto) {
    await this.assertProject(dto.projectId);
    await this.assertAssignees(dto);
    this.assertDates(dto.startDate, dto.expectedCompletionDate);
    try {
      return await this.jobs.create(this.toPersistence(dto));
    } catch (error: any) {
      if (error?.code === 11000) throw new BadRequestException('Job reference must be unique within this project');
      throw error;
    }
  }

  async findAll(query: ListJobsQueryDto, userId?: string) {
    const filter: Record<string, unknown> = {};
    if (query.projectId) filter.projectId = new Types.ObjectId(query.projectId);
    if (query.engineerId) filter.assignedEngineerId = new Types.ObjectId(query.engineerId);
    if (query.supervisorId) filter.assignedSupervisorId = new Types.ObjectId(query.supervisorId);
    if (query.teamId) filter.assignedTeamId = query.teamId;
    if (query.status) filter.status = query.status;
    if (query.dateFrom || query.dateTo) filter.startDate = { ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { $lte: new Date(query.dateTo) } : {}) };
    if (query.search) filter.$text = { $search: query.search };
    if (userId) filter.assignedEngineerId = await this.engineerIdForUser(userId);
    const [items, total] = await Promise.all([this.jobs.find(filter).sort(query.search ? { score: { $meta: 'textScore' } } : { createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean().exec(), this.jobs.countDocuments(filter)]);
    return { data: await Promise.all(items.map((job) => this.toResponse(job))), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOne(id: string, userId?: string) {
    const job = await this.findJob(id);
    if (userId && job.assignedEngineerId?.toString() !== (await this.engineerIdForUser(userId)).toString()) throw new ForbiddenException('You are not assigned to this job');
    return this.toResponse(job);
  }

  async update(id: string, dto: UpdateJobDto) {
    const job = await this.findJob(id);
    if (dto.projectId && dto.projectId !== job.projectId.toString()) throw new BadRequestException('A job cannot be moved to another project');
    await this.assertAssignees(dto);
    this.assertDates(dto.startDate ?? job.startDate.toISOString(), dto.expectedCompletionDate ?? job.expectedCompletionDate.toISOString());
    const updated = await this.jobs.findByIdAndUpdate(id, this.toPersistence(dto), { new: true }).exec();
    return this.toResponse(updated);
  }

  async remove(id: string) { await this.findJob(id); await this.jobs.findByIdAndDelete(id).exec(); return { deleted: true }; }

  private async findJob(id: string) { if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Job not found'); const job = await this.jobs.findById(id).exec(); if (!job) throw new NotFoundException('Job not found'); return job; }
  private async assertProject(id: string) { if (!Types.ObjectId.isValid(id) || !(await this.projects.exists({ _id: id }))) throw new BadRequestException('Project was not found'); }
  private async assertAssignees(dto: Partial<CreateJobDto>) { for (const id of [dto.assignedEngineerId, dto.assignedSupervisorId]) if (id && (!Types.ObjectId.isValid(id) || !(await this.members.exists({ _id: id })))) throw new BadRequestException('Assigned team member was not found'); }
  private assertDates(start: string, end: string) { if (new Date(end) < new Date(start)) throw new BadRequestException('Expected completion date cannot be before the start date'); }
  private async engineerIdForUser(userId: string) { const user = await (this.members.db.collection('auth_users').findOne({ _id: new Types.ObjectId(userId) }, { projection: { email: 1 } })); const engineer = user ? await this.members.findOne({ workEmail: user.email }).select('_id').lean().exec() : null; if (!engineer) throw new ForbiddenException('No engineer profile is associated with this account'); return engineer._id; }
  private toPersistence(dto: Partial<CreateJobDto>) { const data: Record<string, unknown> = { ...dto }; if (dto.projectId) data.projectId = new Types.ObjectId(dto.projectId); if (dto.assignedEngineerId) data.assignedEngineerId = new Types.ObjectId(dto.assignedEngineerId); if (dto.assignedSupervisorId) data.assignedSupervisorId = new Types.ObjectId(dto.assignedSupervisorId); if (dto.jobReference) data.jobReference = dto.jobReference.trim().toUpperCase(); if (dto.startDate) data.startDate = new Date(dto.startDate); if (dto.expectedCompletionDate) data.expectedCompletionDate = new Date(dto.expectedCompletionDate); return data; }
  private async toResponse(job: any) { const data = job.toObject ? job.toObject() : job; const [project, engineer, supervisor] = await Promise.all([this.projects.findById(data.projectId).select('name clientName').lean().exec(), data.assignedEngineerId ? this.members.findById(data.assignedEngineerId).select('fullName').lean().exec() : null, data.assignedSupervisorId ? this.members.findById(data.assignedSupervisorId).select('fullName').lean().exec() : null]); return { ...data, id: data._id?.toString() ?? data.id, _id: undefined, project: project ? { id: project._id.toString(), name: project.name, clientName: project.clientName } : null, assignedEngineerId: data.assignedEngineerId?.toString?.() ?? null, assignedSupervisorId: data.assignedSupervisorId?.toString?.() ?? null, engineer: engineer ? { id: engineer._id.toString(), name: engineer.fullName } : null, supervisor: supervisor ? { id: supervisor._id.toString(), name: supervisor.fullName } : null }; }
}
