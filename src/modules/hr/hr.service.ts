import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MongoService } from '../../common/services/mongo.service';
import { HrPlanStatus } from '../../common/schemas';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { ListPlansDto } from './dto/list-plans.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';

export interface UploadedPhoto {
  buffer: Buffer;
  mimetype: string;
}

@Injectable()
export class HrService {
  constructor(private readonly mongo: MongoService) {}

  async createDepartment(dto: CreateDepartmentDto) {
    const name = dto.name.trim();
    await this.assertDepartmentNameAvailable(name);
    return this.toDepartmentResponse(
      await this.mongo.department.create({ data: { ...dto, name } }),
    );
  }

  async findAllDepartments() {
    const departments = await this.mongo.department.findMany({
      orderBy: { name: 'asc' },
    });
    return departments.map((department) =>
      this.toDepartmentResponse(department),
    );
  }

  async findDepartment(id: string) {
    const department = await this.mongo.department.findUnique({
      where: { id },
    });
    if (!department) throw new NotFoundException('Department not found');
    return this.toDepartmentResponse(department);
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    await this.findDepartment(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
      await this.assertDepartmentNameAvailable(data.name as string, id);
    }
    return this.toDepartmentResponse(
      await this.mongo.department.update({ where: { id }, data }),
    );
  }

  async removeDepartment(id: string) {
    await this.findDepartment(id);
    const planCount = await this.mongo.hrPlan.count({
      where: { departmentId: id },
    });
    if (planCount > 0) {
      throw new BadRequestException(
        'Cannot delete a department that has plans',
      );
    }
    const memberCount = await this.mongo.teamMember.count({
      where: { departmentId: id },
    });
    if (memberCount > 0) {
      throw new BadRequestException(
        'Cannot delete a department that has team members',
      );
    }
    await this.mongo.department.delete({ where: { id } });
    return { deleted: true };
  }

  async createPlan(dto: CreatePlanDto, createdById: string) {
    this.assertPlanDates(dto.startDate, dto.endDate);
    await this.findDepartment(dto.departmentId);
    return this.mongo.hrPlan.create({
      data: { ...dto, status: dto.status || HrPlanStatus.Draft, createdById },
    });
  }

  async findAllPlans(query: ListPlansDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const where: Record<string, unknown> = {};
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.status) where.status = query.status;
    const [items, total] = await Promise.all([
      this.mongo.hrPlan.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startDate: 'desc' },
      }),
      this.mongo.hrPlan.count({ where }),
    ]);
    return {
      items,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findPlan(id: string) {
    const plan = await this.mongo.hrPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const existing = await this.findPlan(id);
    const startDate = dto.startDate || existing.startDate;
    const endDate = dto.endDate || existing.endDate;
    this.assertPlanDates(startDate, endDate);
    if (dto.departmentId !== undefined)
      await this.findDepartment(dto.departmentId);
    return this.mongo.hrPlan.update({ where: { id }, data: { ...dto } });
  }

  async removePlan(id: string) {
    await this.findPlan(id);
    await this.mongo.hrPlan.delete({ where: { id } });
    return { deleted: true };
  }

  async createTeamMember(dto: CreateTeamMemberDto, photo?: UploadedPhoto) {
    await this.findDepartment(dto.departmentId);
    await this.assertWorkEmailAvailable(dto.workEmail);
    const { photo: _photo, ...data } = dto;
    return this.mongo.teamMember.create({
      data: {
        ...data,
        workEmail: dto.workEmail.toLowerCase(),
        ...(photo
          ? {
              photoData: photo.buffer,
              photoMimeType: photo.mimetype,
              hasPhoto: true,
            }
          : {}),
      },
    });
  }

  async findAllTeamMembers() {
    return this.mongo.teamMember.findMany({ orderBy: { fullName: 'asc' } });
  }

  async findTeamMember(id: string) {
    const member = await this.mongo.teamMember.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Team member not found');
    return member;
  }

  async updateTeamMember(
    id: string,
    dto: UpdateTeamMemberDto,
    photo?: UploadedPhoto,
  ) {
    await this.findTeamMember(id);
    if (dto.departmentId) await this.findDepartment(dto.departmentId);
    if (dto.workEmail) await this.assertWorkEmailAvailable(dto.workEmail, id);
    const { photo: _photo, ...data } = dto;
    return this.mongo.teamMember.update({
      where: { id },
      data: {
        ...data,
        ...(dto.workEmail ? { workEmail: dto.workEmail.toLowerCase() } : {}),
        ...(photo
          ? {
              photoData: photo.buffer,
              photoMimeType: photo.mimetype,
              hasPhoto: true,
            }
          : {}),
      },
    });
  }

  async removeTeamMember(id: string) {
    await this.findTeamMember(id);
    await this.mongo.teamMember.delete({ where: { id } });
    return { deleted: true };
  }

  async findTeamMemberPhoto(id: string) {
    const member = await this.mongo.teamMember.findUnique({
      where: { id },
      select: { photoData: true, photoMimeType: true },
    });
    if (!member) throw new NotFoundException('Team member not found');
    if (!member.photoData || !member.photoMimeType) {
      throw new NotFoundException('Team member photo not found');
    }
    return { data: member.photoData, mimeType: member.photoMimeType };
  }

  private async assertDepartmentNameAvailable(name: string, exceptId?: string) {
    const existing = await this.mongo.department.findFirst({
      where: { name: new RegExp(`^${this.escapeRegex(name)}$`, 'i') },
    });
    if (existing && existing.id !== exceptId)
      throw new ConflictException('A department with this name already exists');
  }

  private async assertWorkEmailAvailable(email: string, exceptId?: string) {
    const existing = await this.mongo.teamMember.findFirst({
      where: { workEmail: email.toLowerCase() },
    });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('A team member with this work email exists');
    }
  }

  private assertPlanDates(startDate: Date, endDate: Date) {
    if (startDate > endDate)
      throw new BadRequestException(
        'Plan end date must be on or after its start date',
      );
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private toDepartmentResponse(department: Record<string, unknown>) {
    const response = { ...department };
    delete response.headId;
    return response;
  }
}
