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

@Injectable()
export class HrService {
  constructor(private readonly mongo: MongoService) {}

  async createDepartment(dto: CreateDepartmentDto) {
    const name = dto.name.trim();
    await this.assertDepartmentNameAvailable(name);
    await this.assertUserExists(dto.headId);
    return this.mongo.department.create({ data: { ...dto, name } });
  }

  async findAllDepartments() {
    return this.mongo.department.findMany({ orderBy: { name: 'asc' } });
  }

  async findDepartment(id: string) {
    const department = await this.mongo.department.findUnique({
      where: { id },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    await this.findDepartment(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
      await this.assertDepartmentNameAvailable(data.name as string, id);
    }
    if (dto.headId !== undefined) await this.assertUserExists(dto.headId);
    return this.mongo.department.update({ where: { id }, data });
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

  private async assertUserExists(id: string) {
    const user = await this.mongo.authUser.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Department head user not found');
  }

  private async assertDepartmentNameAvailable(name: string, exceptId?: string) {
    const existing = await this.mongo.department.findFirst({
      where: { name: new RegExp(`^${this.escapeRegex(name)}$`, 'i') },
    });
    if (existing && existing.id !== exceptId)
      throw new ConflictException('A department with this name already exists');
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
}
