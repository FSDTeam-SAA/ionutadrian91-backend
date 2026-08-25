import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DutyOfCare,
  DutyOfCareDocument,
  IncidentReport,
  IncidentReportDocument,
  IncidentStatus,
  LeaveRequest,
  LeaveRequestDocument,
  LeaveStatus,
  Project,
  ProjectDocument,
  ProjectStatus,
  RiskAssessment,
  RiskAssessmentDocument,
  RiskAssessmentStatus,
  TeamMember,
  TeamMemberDocument,
  Whereabouts,
  WhereaboutsDocument,
} from '../../common/schemas';

type Activity = {
  id: string;
  type: 'duty' | 'incident' | 'project' | 'leave';
  text: string;
  occurredAt: Date;
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(DutyOfCare.name)
    private readonly dutyOfCare: Model<DutyOfCareDocument>,
    @InjectModel(IncidentReport.name)
    private readonly incidents: Model<IncidentReportDocument>,
    @InjectModel(LeaveRequest.name)
    private readonly leaveRequests: Model<LeaveRequestDocument>,
    @InjectModel(Project.name)
    private readonly projects: Model<ProjectDocument>,
    @InjectModel(RiskAssessment.name)
    private readonly riskAssessments: Model<RiskAssessmentDocument>,
    @InjectModel(Whereabouts.name)
    private readonly whereabouts: Model<WhereaboutsDocument>,
    @InjectModel(TeamMember.name)
    private readonly teamMembers: Model<TeamMemberDocument>,
  ) {}

  async getOverview() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const [activeDuties, completedDuties, openIncidents, submittedRisks, todaysPlans, pendingLeaveApplications, activeProjects, recentDuties, recentIncidents, recentProjects, recentLeaves] = await Promise.all([
      this.dutyOfCare
        .find({ startTime: { $gte: startOfToday, $lte: endOfToday }, endTime: null })
        .populate('teamMemberId', 'fullName')
        .lean(),
      this.dutyOfCare
        .find({ startTime: { $gte: startOfToday, $lte: endOfToday }, endTime: { $ne: null } })
        .lean(),
      this.incidents.find({ status: { $in: [IncidentStatus.NEW, IncidentStatus.INVESTIGATING] } }).lean(),
      this.riskAssessments.countDocuments({ status: RiskAssessmentStatus.Submitted }),
      this.whereabouts.countDocuments({ startDate: { $lte: endOfToday }, endDate: { $gte: startOfToday } }),
      this.leaveRequests.countDocuments({ status: LeaveStatus.PENDING }),
      this.projects.find({ status: ProjectStatus.PENDING }).sort({ endDate: 1 }).limit(4).lean(),
      this.dutyOfCare.find().populate('teamMemberId', 'fullName').sort({ updatedAt: -1 }).limit(4).lean(),
      this.incidents.find().populate('teamMemberId', 'fullName').sort({ updatedAt: -1 }).limit(4).lean(),
      this.projects.find().sort({ updatedAt: -1 }).limit(4).lean(),
      this.leaveRequests.find().populate('teamMemberId', 'fullName').sort({ updatedAt: -1 }).limit(4).lean(),
    ]);

    const activeEngineerIds = new Set(activeDuties.map((duty) => String(duty.teamMemberId?._id ?? duty.teamMemberId)));
    const completedEngineerIds = new Set(completedDuties.map((duty) => String(duty.teamMemberId)));
    const activity: Activity[] = [
      ...recentDuties.map((duty: any) => ({
        id: String(duty._id),
        type: 'duty' as const,
        text: `${duty.teamMemberId?.fullName ?? 'Team member'} ${duty.endTime ? 'checked out' : 'checked in'}`,
        occurredAt: duty.updatedAt ?? duty.createdAt,
      })),
      ...recentIncidents.map((incident: any) => ({
        id: String(incident._id),
        type: 'incident' as const,
        text: `${incident.type} incident is ${String(incident.status).toLowerCase()}`,
        occurredAt: incident.updatedAt ?? incident.createdAt,
      })),
      ...recentProjects.map((project: any) => ({
        id: String(project._id),
        type: 'project' as const,
        text: `${project.name} project was updated`,
        occurredAt: project.updatedAt ?? project.createdAt,
      })),
      ...recentLeaves.map((leave: any) => ({
        id: String(leave._id),
        type: 'leave' as const,
        text: leave.status === LeaveStatus.PENDING
          ? `${leave.teamMemberId?.fullName ?? 'Team member'} submitted a leave application`
          : `${leave.teamMemberId?.fullName ?? 'Team member'}'s leave application was ${String(leave.status).toLowerCase()}`,
        occurredAt: leave.updatedAt ?? leave.createdAt,
      })),
    ]
      .filter((item) => item.occurredAt)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 6);

    return {
      workforce: {
        engineersOutToday: activeEngineerIds.size,
        homeSafeToday: completedEngineerIds.size,
        stillTravelling: activeEngineerIds.size,
        activeAlerts: openIncidents.length,
      },
      apps: {
        riskAssessments: submittedRisks,
        whereabouts: todaysPlans,
        dutyOfCare: { homeSafe: completedEngineerIds.size, active: activeEngineerIds.size },
        incidents: openIncidents.length,
        leaveApplications: pendingLeaveApplications,
      },
      projects: activeProjects.map((project: any) => ({
        id: String(project._id),
        name: project.name,
        description: project.description,
        clientName: project.clientName,
        status: project.status,
        endDate: project.endDate,
      })),
      activity,
    };
  }
}
