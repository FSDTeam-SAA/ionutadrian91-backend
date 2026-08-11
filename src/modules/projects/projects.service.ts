import { Injectable, NotFoundException } from '@nestjs/common';
import { MongoService } from '../../common/services/mongo.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly mongo: MongoService) {}

  async create(dto: CreateProjectDto) {
    return this.mongo.project.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    });
  }

  async findAll(filters: { name?: string; startDate?: string; endDate?: string }) {
    const query: any = {};

    if (filters.name) {
      query.name = { $regex: filters.name, $options: 'i' };
    }

    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    return this.mongo.project.find(query).sort({ createdAt: -1 });
  }

  async findOne(id: string) {
    const project = await this.mongo.project.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    const updateData: any = { ...dto };
    if (dto.startDate) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate) updateData.endDate = new Date(dto.endDate);

    const project = await this.mongo.project.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async remove(id: string) {
    const result = await this.mongo.project.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Project not found');
    }
    return { success: true };
  }
}
