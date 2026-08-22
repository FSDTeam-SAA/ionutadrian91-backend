import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Project,
  RiskAssessment,
  RiskAssessmentDocument,
  RiskAssessmentStatus,
  TeamMember,
  Whereabouts,
} from '../../common/schemas';
import {
  CreateRiskAssessmentDto,
  RiskAssessmentQueryDto,
  UpdateRiskAssessmentDto,
} from './dto/risk-assessment.dto';
@Injectable()
export class RiskAssessmentsService {
  constructor(
    @InjectModel(RiskAssessment.name)
    private readonly assessments: Model<RiskAssessmentDocument>,
    @InjectModel(Whereabouts.name) private readonly assignments: Model<any>,
    @InjectModel(Project.name) private readonly projects: Model<any>,
    @InjectModel(TeamMember.name) private readonly members: Model<any>,
  ) {}
  async list(query: RiskAssessmentQueryDto, userId?: string) {
    const f: any = {};
    if (query.projectId) f.projectId = query.projectId;
    if (query.assignmentId) f.assignmentId = query.assignmentId;
    if (query.status) f.status = query.status;
    if (userId) f.engineerId = await this.engineerFor(userId);
    return this.assessments.find(f).sort({ createdAt: -1 }).lean().exec();
  }
  async create(dto: CreateRiskAssessmentDto, userId: string) {
    const engineerId = await this.engineerFor(userId);
    await this.validateAssignment(dto.projectId, dto.assignmentId, engineerId);
    return this.assessments.create({
      ...dto,
      engineerId,
      assessmentNumber: `RA-${Date.now()}`,
      status: RiskAssessmentStatus.Draft,
    });
  }
  async update(id: string, dto: UpdateRiskAssessmentDto, userId: string) {
    const a = await this.owned(id, userId);
    if (a.status !== RiskAssessmentStatus.Draft)
      throw new ForbiddenException('Only drafts can be edited');
    if (dto.projectId || dto.assignmentId)
      await this.validateAssignment(
        dto.projectId ?? a.projectId.toString(),
        dto.assignmentId ?? a.assignmentId.toString(),
        a.engineerId,
      );
    return this.assessments.findByIdAndUpdate(id, dto, { new: true }).exec();
  }
  async submit(id: string, userId: string) {
    const a = await this.owned(id, userId);
    if (a.status !== RiskAssessmentStatus.Draft)
      throw new BadRequestException('Only drafts can be submitted');
    if (
      !a.workActivity ||
      !a.hazards.length ||
      a.hazards.some(
        (h) => !h.hazard || !h.risk || !h.controlMeasures?.length,
      ) ||
      !a.engineerConfirmed ||
      !a.signatureUrl
    )
      throw new BadRequestException(
        'Complete hazards, confirmation, and signature before submitting',
      );
    return this.assessments
      .findByIdAndUpdate(
        id,
        { status: RiskAssessmentStatus.Submitted, submittedAt: new Date() },
        { new: true },
      )
      .exec();
  }
  async review(id: string) {
    const a = await this.assessments.findById(id).exec();
    if (!a) throw new NotFoundException('Risk assessment not found');
    if (a.status !== RiskAssessmentStatus.Submitted)
      throw new BadRequestException(
        'Only submitted assessments can be reviewed',
      );
    return this.assessments
      .findByIdAndUpdate(
        id,
        { status: RiskAssessmentStatus.Reviewed },
        { new: true },
      )
      .exec();
  }
  private async owned(id: string, userId: string) {
    const a = await this.assessments.findById(id).exec();
    if (!a) throw new NotFoundException('Risk assessment not found');
    if (a.engineerId.toString() !== (await this.engineerFor(userId)).toString())
      throw new ForbiddenException('You can only access your own assessments');
    return a;
  }
  /**
   * An assessment may only be created for an assignment that belongs to the
   * selected project and includes the current team member.
   */
  private async validateAssignment(
    projectId: string,
    assignmentId: string,
    engineerId: any,
  ) {
    const assignment = await this.assignments
      .findById(assignmentId)
      .lean()
      .exec();
    if (!assignment) throw new NotFoundException('Assignment not found');
    const isAssigned = [
      ...(assignment.engineers ?? []),
      ...(assignment.workers ?? []),
    ].some((memberId: any) => this.sameId(memberId, engineerId));
    if (!this.sameId(assignment.projectId, projectId) || !isAssigned)
      throw new ForbiddenException(
        'Assignment must belong to the project and be assigned to you',
      );
    if (!(await this.projects.exists({ _id: projectId })))
      throw new BadRequestException('Project not found');
  }
  private sameId(value: unknown, expected: unknown) {
    return (
      value != null && expected != null && String(value) === String(expected)
    );
  }
  private async engineerFor(userId: string) {
    const user = await this.members.db
      .collection('auth_users')
      .findOne(
        { _id: new Types.ObjectId(userId) },
        { projection: { email: 1 } },
      );
    const e = user
      ? await this.members
          .findOne({ workEmail: user.email })
          .select('_id')
          .lean()
          .exec()
      : null;
    if (!e)
      throw new ForbiddenException(
        'No engineer profile associated with this account',
      );
    return e._id;
  }
}
