import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MongoService } from '../../common/services/mongo.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { Types } from 'mongoose';

@Injectable()
export class DutyOfCareService {
  constructor(private readonly mongo: MongoService) {}

  private async getTeamMemberByUserId(userId: string) {
    const user = await this.mongo.authUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Authentication record not found');
    return this.mongo.teamMemberModel.findOne({ workEmail: user.email });
  }

  async clockIn(userId: string, dto: ClockInDto) {
    const teamMember = await this.getTeamMemberByUserId(userId);
    if (!teamMember) {
      throw new NotFoundException('Your Team Member profile was not found. Please create a profile in the HR module with your email address to clock in.');
    }

    // Optional: Check if already clocked in without clocking out
    const activeDuty = await this.mongo.dutyOfCare.findOne({
      teamMemberId: teamMember._id,
      endTime: null,
    });

    if (activeDuty) {
      throw new BadRequestException('You are already clocked in. Please clock out first.');
    }

    const payload: any = {
      teamMemberId: teamMember._id,
      startTime: new Date(),
      notes: dto.notes || '',
    };

    if (dto.projectId) {
      payload.projectId = new Types.ObjectId(dto.projectId);
    }

    return this.mongo.dutyOfCare.create(payload);
  }

  async clockOut(userId: string, id: string, dto: ClockOutDto) {
    const teamMember = await this.getTeamMemberByUserId(userId);
    if (!teamMember) {
      throw new NotFoundException('Your Team Member profile was not found. Please create a profile in the HR module with your email address.');
    }

    const duty = await this.mongo.dutyOfCare.findOne({
      _id: id,
      teamMemberId: teamMember._id,
    });

    if (!duty) {
      throw new NotFoundException('Duty of care record not found');
    }

    if (duty.endTime) {
      throw new BadRequestException('You have already clocked out of this shift.');
    }

    duty.endTime = new Date();
    if (dto.notes) {
      duty.notes = duty.notes ? `${duty.notes} | Clock-out note: ${dto.notes}` : dto.notes;
    }

    await duty.save();
    return duty;
  }

  async findMyRecords(userId: string) {
    const teamMember = await this.getTeamMemberByUserId(userId);
    if (!teamMember) {
      // If the user (e.g., Admin) doesn't have a profile, they simply have no records yet.
      return [];
    }

    return this.mongo.dutyOfCare
      .find({ teamMemberId: teamMember._id })
      .populate('teamMemberId', 'fullName workEmail jobTitle employeeCategory')
      .populate('projectId', 'name status')
      .sort({ startTime: -1 });
  }

  async findAll(filters: {
    startDate?: string;
    endDate?: string;
    teamMemberId?: string;
    projectId?: string;
  }) {
    const query: any = {};

    if (filters.startDate || filters.endDate) {
      query.startTime = {};
      if (filters.startDate) query.startTime.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setUTCHours(23, 59, 59, 999);
        query.startTime.$lte = end;
      }
    }

    if (filters.teamMemberId) {
      query.teamMemberId = new Types.ObjectId(filters.teamMemberId);
    }

    if (filters.projectId) {
      query.projectId = new Types.ObjectId(filters.projectId);
    }

    return this.mongo.dutyOfCare
      .find(query)
      .populate('teamMemberId', 'fullName workEmail jobTitle employeeCategory')
      .populate('projectId', 'name status')
      .sort({ startTime: -1 });
  }

  async findOne(id: string) {
    const duty = await this.mongo.dutyOfCare
      .findById(id)
      .populate('teamMemberId', 'fullName workEmail jobTitle employeeCategory')
      .populate('projectId', 'name status');

    if (!duty) {
      throw new NotFoundException('Duty of care record not found');
    }
    return duty;
  }

  async remove(id: string) {
    const result = await this.mongo.dutyOfCare.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Duty of care record not found');
    }
    return { success: true };
  }
}
