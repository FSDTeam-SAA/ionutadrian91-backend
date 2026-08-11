import { Injectable, NotFoundException } from '@nestjs/common';
import { MongoService } from '../../common/services/mongo.service';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { Types } from 'mongoose';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly mongo: MongoService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(email: string, dto: CreateIncidentDto, file?: Express.Multer.File) {
    const teamMember = await this.mongo.teamMemberModel.findOne({ workEmail: email });
    if (!teamMember) {
      throw new NotFoundException('Team member profile not found');
    }

    let photoUrl: string | null = null;
    let photoPublicId: string | null = null;

    if (file) {
      const upload = await this.cloudinary.uploadIncidentPhoto(
        file.buffer,
        file.mimetype,
      );
      photoUrl = upload.url;
      photoPublicId = upload.publicId;
    }

    const incident = await this.mongo.incidentReport.create({
      teamMemberId: teamMember._id,
      projectId: new Types.ObjectId(dto.projectId),
      date: new Date(dto.date),
      details: dto.details,
      location: dto.location,
      photoUrl,
      photoPublicId,
    });

    return incident;
  }

  async findAll(filters: {
    startDate?: string;
    endDate?: string;
    projectId?: string;
    status?: string;
  }) {
    const query: any = {};

    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) query.date.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setUTCHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (filters.projectId) {
      query.projectId = new Types.ObjectId(filters.projectId);
    }

    if (filters.status) {
      query.status = filters.status;
    }

    return this.mongo.incidentReport
      .find(query)
      .populate('teamMemberId', 'fullName workEmail jobTitle employeeCategory')
      .populate('projectId', 'name status clientName')
      .sort({ date: -1 });
  }

  async getDashboardStats() {
    const stats = await this.mongo.incidentReport.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const formattedStats = {
      NEW: 0,
      INVESTIGATING: 0,
      CLOSED: 0,
      total: 0,
    };

    stats.forEach((stat) => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    return formattedStats;
  }

  async findOne(id: string) {
    const incident = await this.mongo.incidentReport
      .findById(id)
      .populate('teamMemberId', 'fullName workEmail jobTitle employeeCategory')
      .populate('projectId', 'name status clientName');

    if (!incident) {
      throw new NotFoundException('Incident report not found');
    }
    return incident;
  }

  async update(id: string, dto: UpdateIncidentDto) {
    const updateData: any = { ...dto };

    const incident = await this.mongo.incidentReport.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    )
    .populate('teamMemberId')
    .populate('projectId');

    if (!incident) {
      throw new NotFoundException('Incident report not found');
    }
    return incident;
  }

  async remove(id: string) {
    const result = await this.mongo.incidentReport.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Incident report not found');
    }
    return { success: true };
  }
}
