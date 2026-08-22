import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WorkspaceFile,
  WorkspaceFolder,
  TeamMember,
} from '../../common/schemas';
import { CloudinaryService } from '../../common/services/cloudinary.service';
@Injectable()
export class WorkspaceFilesService {
  constructor(
    @InjectModel(WorkspaceFolder.name) private folders: Model<any>,
    @InjectModel(WorkspaceFile.name) private files: Model<any>,
    @InjectModel(TeamMember.name) private members: Model<any>,
    private cloudinary: CloudinaryService,
  ) {}
  async list(userId: string, manager: boolean) {
    const memberId = manager ? null : await this.memberId(userId);
    const folderQuery = manager ? {} : { $or: [{ memberIds: memberId }] };
    const folders = await this.folders.find(folderQuery).lean().exec();
    const ids = folders.map((f: any) => f._id);
    const files = await this.files
      .find(
        manager
          ? {}
          : {
              $or: [
                { folderId: { $in: ids } },
                { folderId: null, uploadedBy: new Types.ObjectId(userId) },
              ],
            },
      )
      .lean()
      .exec();
    return { folders, files };
  }
  async createFolder(name: string, memberIds: string[], userId: string) {
    return this.folders.create({
      name: name.trim(),
      memberIds: memberIds.map((id) => new Types.ObjectId(id)),
      createdBy: new Types.ObjectId(userId),
    });
  }
  async upload(
    file: Express.Multer.File,
    folderId: string | undefined,
    userId: string,
    manager: boolean,
  ) {
    if (folderId) await this.folderAccess(folderId, userId, manager);
    const uploaded = await this.cloudinary.uploadWorkspaceFile(
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    return this.files.create({
      name: file.originalname,
      url: uploaded.url,
      publicId: uploaded.publicId,
      mimeType: file.mimetype,
      size: file.size,
      folderId: folderId ? new Types.ObjectId(folderId) : null,
      uploadedBy: new Types.ObjectId(userId),
    });
  }
  async move(id: string, folderId: string, userId: string, manager: boolean) {
    await this.folderAccess(folderId, userId, manager);
    const file = await this.files.findById(id);
    if (!file) throw new NotFoundException('File not found');
    if (!manager)
      await this.folderAccess(file.folderId?.toString(), userId, false);
    file.folderId = new Types.ObjectId(folderId);
    return file.save();
  }
  private async folderAccess(
    id: string | undefined,
    userId: string,
    manager: boolean,
  ) {
    if (!id) throw new ForbiddenException('Folder is required');
    const folder = await this.folders.findById(id).lean().exec();
    if (!folder) throw new NotFoundException('Folder not found');
    if (!manager) {
      const memberId = await this.memberId(userId);
      if (!folder.memberIds.some((v: any) => String(v) === String(memberId)))
        throw new ForbiddenException('You do not have access to this folder');
    }
    return folder;
  }
  private async memberId(userId: string) {
    const user = await this.members.db
      .collection('auth_users')
      .findOne(
        { _id: new Types.ObjectId(userId) },
        { projection: { email: 1 } },
      );
    const member = user
      ? await this.members
          .findOne({ workEmail: user.email })
          .select('_id')
          .lean()
          .exec()
      : null;
    if (!member)
      throw new ForbiddenException(
        'No team member profile associated with this account',
      );
    return member._id;
  }
}
