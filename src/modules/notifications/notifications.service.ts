import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LeaveRequest, RiskAssessment, Timesheet, TimesheetUnlockRequest } from '../../common/schemas';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(LeaveRequest.name) private readonly leaveRequests: Model<LeaveRequest>,
    @InjectModel(RiskAssessment.name) private readonly riskAssessments: Model<RiskAssessment>,
    @InjectModel(Timesheet.name) private readonly timesheets: Model<Timesheet>,
    @InjectModel(TimesheetUnlockRequest.name) private readonly unlockRequests: Model<TimesheetUnlockRequest>,
  ) {}

  async getAdminPendingActions() {
    const [leave, risk, sheets, unlocks] = await Promise.all([
      this.leaveRequests.find({ status: 'PENDING' as any })
        .populate('teamMemberId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .exec(),
      this.riskAssessments.find({ status: 'SUBMITTED' as any })
        .populate('engineerId', 'fullName')
        .sort({ submittedAt: -1 })
        .limit(10)
        .lean()
        .exec(),
      this.timesheets.find({ status: 'SUBMITTED' as any })
        .populate('engineerId', 'fullName')
        .sort({ submittedAt: -1 })
        .limit(10)
        .lean()
        .exec(),
      this.unlockRequests.find({ status: 'PENDING' as any as any })
        .populate('engineerId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .exec(),
    ]);

    const notifications: any[] = [];

    for (const item of leave) {
      notifications.push({
        id: item._id.toString(),
        title: 'Leave Request',
        message: `${(item.teamMemberId as any)?.fullName || 'An engineer'} requested leave.`,
        type: 'LEAVE_REQUEST',
        actionUrl: '/leave',
        createdAt: (item as any)['createdAt'],
      });
    }

    for (const item of risk) {
      notifications.push({
        id: item._id.toString(),
        title: 'Risk Assessment Pending',
        message: `${(item.engineerId as any)?.fullName || 'An engineer'} submitted a risk assessment.`,
        type: 'RISK_ASSESSMENT',
        actionUrl: '/risk-assessments',
        createdAt: (item as any)['submittedAt'] || (item as any)['createdAt'],
      });
    }

    for (const item of sheets) {
      notifications.push({
        id: item._id.toString(),
        title: 'Timesheet Pending',
        message: `${(item.engineerId as any)?.fullName || 'An engineer'} submitted a timesheet.`,
        type: 'TIMESHEET',
        actionUrl: '/timesheets',
        createdAt: (item as any)['submittedAt'] || (item as any)['createdAt'],
      });
    }

    for (const item of unlocks) {
      notifications.push({
        id: item._id.toString(),
        title: 'Timesheet Unlock Request',
        message: `${(item.engineerId as any)?.fullName || 'An engineer'} requested to unlock a timesheet.`,
        type: 'TIMESHEET_UNLOCK',
        actionUrl: '/timesheets',
        createdAt: (item as any)['createdAt'],
      });
    }

    return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
