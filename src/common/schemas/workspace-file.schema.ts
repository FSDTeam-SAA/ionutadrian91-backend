import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
export type WorkspaceFolderDocument = HydratedDocument<WorkspaceFolder>;
export type WorkspaceFileDocument = HydratedDocument<WorkspaceFile>;
@Schema({ timestamps: true, collection: 'workspace_folders' })
export class WorkspaceFolder {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ type: [Types.ObjectId], ref: 'TeamMember', default: [] })
  memberIds: Types.ObjectId[];
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true })
  createdBy: Types.ObjectId;
}
@Schema({ timestamps: true, collection: 'workspace_files' })
export class WorkspaceFile {
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) publicId: string;
  @Prop({ required: true }) mimeType: string;
  @Prop({ required: true }) size: number;
  @Prop({ type: Types.ObjectId, ref: 'WorkspaceFolder', default: null })
  folderId?: Types.ObjectId | null;
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true })
  uploadedBy: Types.ObjectId;
}
export const WorkspaceFolderSchema =
  SchemaFactory.createForClass(WorkspaceFolder);
export const WorkspaceFileSchema = SchemaFactory.createForClass(WorkspaceFile);
WorkspaceFolderSchema.index({ memberIds: 1 });
WorkspaceFileSchema.index({ folderId: 1, createdAt: -1 });
