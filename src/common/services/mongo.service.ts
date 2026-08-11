import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActivityLogEvent,
  ActivityLogEventDocument,
  AuthSecurity,
  AuthSecurityDocument,
  AuthUser,
  AuthUserDocument,
  Department,
  DepartmentDocument,
  EmailHistory,
  EmailHistoryDocument,
  LoginHistory,
  LoginHistoryDocument,
  HrPlan,
  HrPlanDocument,
  TeamMember,
  TeamMemberDocument,
  UserProfile,
  UserProfileDocument,
} from '../schemas';

type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  select?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  skip?: number;
  take?: number;
};

@Injectable()
export class MongoService {
  readonly authUser = {
    findFirst: (args: QueryArgs) => this.findOne(this.authUserModel, args),
    findUnique: (args: QueryArgs) => this.findOne(this.authUserModel, args),
    findMany: (args: QueryArgs = {}) => this.findMany(this.authUserModel, args),
    count: (args: QueryArgs = {}) => this.count(this.authUserModel, args),
    create: (args: QueryArgs) => this.create(this.authUserModel, args),
    update: (args: QueryArgs) => this.updateOne(this.authUserModel, args),
  };

  readonly authSecurity = {
    create: (args: QueryArgs) => this.create(this.authSecurityModel, args),
    update: (args: QueryArgs) => this.updateOne(this.authSecurityModel, args),
  };

  readonly department = {
    findFirst: (args: QueryArgs) => this.findOne(this.departmentModel, args),
    findUnique: (args: QueryArgs) => this.findOne(this.departmentModel, args),
    findMany: (args: QueryArgs = {}) =>
      this.findMany(this.departmentModel, args),
    count: (args: QueryArgs = {}) => this.count(this.departmentModel, args),
    create: (args: QueryArgs) => this.create(this.departmentModel, args),
    update: (args: QueryArgs) => this.updateOne(this.departmentModel, args),
    delete: (args: QueryArgs) => this.deleteOne(this.departmentModel, args),
  };

  readonly hrPlan = {
    findFirst: (args: QueryArgs) => this.findOne(this.hrPlanModel, args),
    findUnique: (args: QueryArgs) => this.findOne(this.hrPlanModel, args),
    findMany: (args: QueryArgs = {}) => this.findMany(this.hrPlanModel, args),
    count: (args: QueryArgs = {}) => this.count(this.hrPlanModel, args),
    create: (args: QueryArgs) => this.create(this.hrPlanModel, args),
    update: (args: QueryArgs) => this.updateOne(this.hrPlanModel, args),
    delete: (args: QueryArgs) => this.deleteOne(this.hrPlanModel, args),
  };

  readonly teamMember = {
    findFirst: (args: QueryArgs) => this.findOne(this.teamMemberModel, args),
    findUnique: (args: QueryArgs) => this.findOne(this.teamMemberModel, args),
    findMany: (args: QueryArgs = {}) =>
      this.findMany(this.teamMemberModel, args),
    count: (args: QueryArgs = {}) => this.count(this.teamMemberModel, args),
    create: (args: QueryArgs) => this.create(this.teamMemberModel, args),
    update: (args: QueryArgs) => this.updateOne(this.teamMemberModel, args),
    delete: (args: QueryArgs) => this.deleteOne(this.teamMemberModel, args),
  };

  readonly emailHistory = {
    create: (args: QueryArgs) => this.create(this.emailHistoryModel, args),
    updateMany: (args: QueryArgs) =>
      this.updateMany(this.emailHistoryModel, args),
  };

  readonly loginHistory = {
    create: (args: QueryArgs) => this.create(this.loginHistoryModel, args),
  };

  readonly activityLogEvent = {
    create: (args: QueryArgs) => this.create(this.activityLogModel, args),
  };

  readonly userProfile = {
    findFirst: (args: QueryArgs) => this.findOne(this.userProfileModel, args),
    create: (args: QueryArgs) => this.create(this.userProfileModel, args),
    update: (args: QueryArgs) => this.updateOne(this.userProfileModel, args),
  };

  constructor(
    @InjectModel(AuthUser.name)
    private readonly authUserModel: Model<AuthUserDocument>,
    @InjectModel(AuthSecurity.name)
    private readonly authSecurityModel: Model<AuthSecurityDocument>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(EmailHistory.name)
    private readonly emailHistoryModel: Model<EmailHistoryDocument>,
    @InjectModel(LoginHistory.name)
    private readonly loginHistoryModel: Model<LoginHistoryDocument>,
    @InjectModel(HrPlan.name)
    private readonly hrPlanModel: Model<HrPlanDocument>,
    @InjectModel(TeamMember.name)
    private readonly teamMemberModel: Model<TeamMemberDocument>,
    @InjectModel(ActivityLogEvent.name)
    private readonly activityLogModel: Model<ActivityLogEventDocument>,
    @InjectModel(UserProfile.name)
    private readonly userProfileModel: Model<UserProfileDocument>,
  ) {}

  async $transaction<T>(
    callback: (tx: MongoService) => Promise<T>,
  ): Promise<T> {
    return callback(this);
  }

  private async findOne<T>(model: Model<T>, args: QueryArgs) {
    const query = model.findOne(this.toMongoFilter(args.where));
    if (args.select) {
      query.select(this.toProjection(args.select));
    }

    if (model.modelName === AuthUser.name) {
      query.populate('authSecurity');
    }

    const doc = await query.exec();
    return this.serialize(doc);
  }

  private async create<T>(model: Model<T>, args: QueryArgs) {
    const doc = await model.create(this.normalizeData(args.data || {}) as any);
    const serialized = this.serialize(doc);
    return args.select
      ? this.pickSelected(serialized, args.select)
      : serialized;
  }

  private async findMany<T>(model: Model<T>, args: QueryArgs) {
    const query = model.find(this.toMongoFilter(args.where));
    if (args.select) {
      query.select(this.toProjection(args.select));
    }

    if (args.orderBy) {
      query.sort(
        Object.fromEntries(
          Object.entries(args.orderBy).map(([key, direction]) => [
            key === 'id' ? '_id' : key,
            direction === 'desc' ? -1 : 1,
          ]),
        ),
      );
    }

    if (typeof args.skip === 'number') {
      query.skip(args.skip);
    }

    if (typeof args.take === 'number') {
      query.limit(args.take);
    }

    const docs = await query.exec();
    return docs.map((doc) => this.serialize(doc));
  }

  private async count<T>(model: Model<T>, args: QueryArgs) {
    return model.countDocuments(this.toMongoFilter(args.where)).exec();
  }

  private async updateOne<T>(model: Model<T>, args: QueryArgs) {
    const update = this.toMongoUpdate(args.data || {});
    const doc = await model
      .findOneAndUpdate(this.toMongoFilter(args.where), update, { new: true })
      .exec();

    return this.serialize(doc);
  }

  private async updateMany<T>(model: Model<T>, args: QueryArgs) {
    return model
      .updateMany(
        this.toMongoFilter(args.where),
        this.toMongoUpdate(args.data || {}),
      )
      .exec();
  }

  private async deleteOne<T>(model: Model<T>, args: QueryArgs) {
    const doc = await model
      .findOneAndDelete(this.toMongoFilter(args.where))
      .exec();
    return this.serialize(doc);
  }

  private toMongoFilter(
    where: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(where)) {
      if (key === 'OR' && Array.isArray(value)) {
        filter.$or = value.map((item) =>
          this.toMongoFilter(item as Record<string, unknown>),
        );
        continue;
      }

      if (key === 'id') {
        filter._id = this.toObjectId(value);
        continue;
      }

      if (['authId', 'departmentId', 'createdById'].includes(key)) {
        filter[key] = this.toObjectId(value);
        continue;
      }

      filter[key] = value;
    }

    return filter;
  }

  private toMongoUpdate(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const $set: Record<string, unknown> = {};
    const $inc: Record<string, number> = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null && 'increment' in value) {
        $inc[key] = Number((value as { increment: number }).increment);
      } else {
        $set[key] = this.normalizeValue(key, value);
      }
    }

    return {
      ...(Object.keys($set).length ? { $set } : {}),
      ...(Object.keys($inc).length ? { $inc } : {}),
    };
  }

  private normalizeData(data: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        this.normalizeValue(key, value),
      ]),
    );
  }

  private normalizeValue(key: string, value: unknown) {
    if (['authId', 'departmentId', 'createdById'].includes(key)) {
      return this.toObjectId(value);
    }

    if (
      key === 'details' &&
      typeof value === 'object' &&
      value !== null &&
      'create' in value
    ) {
      return (value as { create: unknown }).create;
    }

    return value;
  }

  private toObjectId(value: unknown) {
    if (value instanceof Types.ObjectId) {
      return value;
    }

    if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }

    return value;
  }

  private toProjection(select: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(select)
        .filter(([, enabled]) => typeof enabled === 'boolean')
        .map(([key, enabled]) => [key === 'id' ? '_id' : key, enabled ? 1 : 0]),
    );
  }

  private serialize(doc: any) {
    if (!doc) {
      return null;
    }

    const value = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    const id = value.id || value._id?.toString();

    return {
      ...value,
      id,
      _id: undefined,
      authId: value.authId?.toString?.() || value.authId,
    };
  }

  private pickSelected(value: any, select: Record<string, unknown>) {
    if (!value) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(select)
        .filter(([, enabled]) => enabled)
        .map(([key]) => [key, value[key]]),
    );
  }
}
