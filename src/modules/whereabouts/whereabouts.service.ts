import { Injectable, NotFoundException } from '@nestjs/common';
import { MongoService } from '../../common/services/mongo.service';
import { CreateWhereaboutsDto } from './dto/create-whereabouts.dto';
import { UpdateWhereaboutsDto } from './dto/update-whereabouts.dto';
import { Types } from 'mongoose';

@Injectable()
export class WhereaboutsService {
  constructor(private readonly mongo: MongoService) {}

  async create(dto: CreateWhereaboutsDto) {
    const whereabouts = await this.mongo.whereabouts.create({
      ...dto,
      projectId: new Types.ObjectId(dto.projectId),
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      engineers: dto.engineers?.map((id) => new Types.ObjectId(id)) || [],
      workers: dto.workers?.map((id) => new Types.ObjectId(id)) || [],
    });
    return whereabouts;
  }

  async findAll(filters: { title?: string; startDate?: string; endDate?: string }) {
    const query: any = {};

    if (filters.title) {
      query.title = { $regex: filters.title, $options: 'i' };
    }

    if (filters.startDate && filters.endDate) {
      // Find tasks where the task timeline overlaps with the requested date range
      query.$or = [
        {
          startDate: { $lte: new Date(filters.endDate) },
          endDate: { $gte: new Date(filters.startDate) },
        },
      ];
    }

    return this.mongo.whereabouts
      .find(query)
      .populate('projectId', 'name status')
      .populate('engineers', 'fullName workEmail jobTitle')
      .populate('workers', 'fullName workEmail jobTitle')
      .sort({ startDate: 1 });
  }

  async findOne(id: string) {
    const whereabouts = await this.mongo.whereabouts
      .findById(id)
      .populate('projectId', 'name status')
      .populate('engineers', 'fullName workEmail jobTitle')
      .populate('workers', 'fullName workEmail jobTitle');

    if (!whereabouts) {
      throw new NotFoundException('Task assignment not found');
    }
    return whereabouts;
  }

  async update(id: string, dto: UpdateWhereaboutsDto) {
    const updateData: any = { ...dto };
    if (dto.projectId) updateData.projectId = new Types.ObjectId(dto.projectId);
    if (dto.startDate) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate) updateData.endDate = new Date(dto.endDate);
    if (dto.engineers) {
      updateData.engineers = dto.engineers.map((e) => new Types.ObjectId(e));
    }
    if (dto.workers) {
      updateData.workers = dto.workers.map((w) => new Types.ObjectId(w));
    }

    const whereabouts = await this.mongo.whereabouts.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    )
    .populate('projectId')
    .populate('engineers')
    .populate('workers');

    if (!whereabouts) {
      throw new NotFoundException('Task assignment not found');
    }
    return whereabouts;
  }

  async remove(id: string) {
    const result = await this.mongo.whereabouts.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Task assignment not found');
    }
    return { success: true };
  }

  async getCalendar(month?: number, year?: number) {
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();

    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59);

    const assignments = await this.mongo.whereabouts
      .find({
        $or: [
          { startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } },
        ],
      })
      .populate('projectId', 'name')
      .select('title startDate endDate location projectId');

    return assignments;
  }
}
