import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { MongoService } from '../../common/services/mongo.service';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { LeaveStatus } from '../../common/schemas';
import { Types } from 'mongoose';

@Injectable()
export class LeaveService {
  constructor(
    private readonly mongo: MongoService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private calculateDays(start: string, end: string): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  async applyLeave(
    userId: string,
    dto: ApplyLeaveDto,
    file?: Express.Multer.File,
  ) {
    const authUser = await this.mongo.authUser.findUnique({ where: { id: userId } });
    if (!authUser) {
      throw new UnauthorizedException('User not found');
    }

    const teamMember = await this.mongo.teamMemberModel.findOne({ workEmail: authUser.email });
    if (!teamMember) {
      throw new NotFoundException('Team member profile not found');
    }

    const requestedDays = this.calculateDays(dto.startDate, dto.endDate);
    if (teamMember.leaveBalance < requestedDays) {
      throw new BadRequestException(
        `You do not have enough leave balance. Requested: ${requestedDays}, Available: ${teamMember.leaveBalance}`,
      );
    }

    let documentUrl: string | null = null;
    let documentPublicId: string | null = null;

    if (file) {
      const upload = await this.cloudinary.uploadDocument(
        file.buffer,
        file.mimetype,
        file.originalname,
      );
      documentUrl = upload.url;
      documentPublicId = upload.publicId;
    }

    const uniqueSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const requestId = `LA-${Date.now().toString().slice(-4)}${uniqueSuffix}`;

    const request = await this.mongo.leaveRequest.create({
      requestId,
      teamMemberId: teamMember._id,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      reason: dto.reason,
      documentUrl,
      documentPublicId,
    });

    return request;
  }

  async getMyHistory(userId: string) {
    const authUser = await this.mongo.authUser.findUnique({ where: { id: userId } });
    if (!authUser) {
      throw new UnauthorizedException('User not found');
    }

    const teamMember = await this.mongo.teamMemberModel.findOne({ workEmail: authUser.email });
    if (!teamMember) {
      throw new NotFoundException('Team member profile not found');
    }

    return this.mongo.leaveRequest
      .find({ teamMemberId: teamMember._id })
      .sort({ createdAt: -1 });
  }

  async updateStatus(id: string, dto: UpdateLeaveStatusDto) {
    const request = await this.mongo.leaveRequest.findById(id).populate('teamMemberId');
    if (!request) {
      throw new NotFoundException('Leave request not found');
    }
    if (request.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Leave request is already processed');
    }

    request.status = dto.status;
    await request.save();

    if (dto.status === LeaveStatus.APPROVED) {
      const requestedDays = this.calculateDays(
        request.startDate.toISOString(),
        request.endDate.toISOString(),
      );
      await this.mongo.teamMemberModel.findByIdAndUpdate(request.teamMemberId, {
        $inc: { leaveBalance: -requestedDays },
      });
    }

    return request;
  }

  async getDashboardStats() {
    const totalRequests = await this.mongo.leaveRequest.countDocuments();
    const pendingRequests = await this.mongo.leaveRequest.countDocuments({
      status: LeaveStatus.PENDING,
    });
    const approvedRequests = await this.mongo.leaveRequest.countDocuments({
      status: LeaveStatus.APPROVED,
    });

    return {
      totalRequests,
      pendingRequests,
      approvedRequests,
    };
  }

  async getAllRequests(filters: {
    departmentId?: string;
    startDate?: string;
    endDate?: string;
    employeeName?: string;
  }) {
    const query: any = {};

    if (filters.startDate && filters.endDate) {
      query.startDate = { $gte: new Date(filters.startDate) };
      query.endDate = { $lte: new Date(filters.endDate) };
    }

    let teamMemberIds: Types.ObjectId[] | null = null;
    const tmQuery: any = {};

    if (filters.departmentId) {
      tmQuery.departmentId = new Types.ObjectId(filters.departmentId);
    }
    if (filters.employeeName) {
      tmQuery.fullName = { $regex: filters.employeeName, $options: 'i' };
    }

    if (Object.keys(tmQuery).length > 0) {
      const members = await this.mongo.teamMemberModel.find(tmQuery).select('_id');
      teamMemberIds = members.map((m) => m._id);
      query.teamMemberId = { $in: teamMemberIds };
    }

    return this.mongo.leaveRequest
      .find(query)
      .populate({
        path: 'teamMemberId',
        select: 'fullName workEmail departmentId jobTitle',
        populate: {
          path: 'departmentId',
          select: 'name',
        },
      })
      .sort({ createdAt: -1 });
  }

  async getCalendar(month?: number, year?: number) {
    if (!month || !year) {
      const now = new Date();
      month = now.getMonth() + 1;
      year = now.getFullYear();
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const leaves = await this.mongo.leaveRequest
      .find({
        status: LeaveStatus.APPROVED,
        $or: [
          { startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } },
        ],
      })
      .populate({
        path: 'teamMemberId',
        select: 'fullName workEmail jobTitle',
      });

    return leaves;
  }
}
