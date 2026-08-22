import { Module } from '@nestjs/common';
import { WorkspaceFilesController } from './workspace-files.controller';
import { WorkspaceFilesService } from './workspace-files.service';
import { CloudinaryService } from '../../common/services/cloudinary.service';
@Module({
  controllers: [WorkspaceFilesController],
  providers: [WorkspaceFilesService, CloudinaryService],
})
export class WorkspaceFilesModule {}
