import {
  BadRequestException,
  Body,
  Param,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../common/schemas';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { WorkspaceFilesService } from './workspace-files.service';
class FolderDto {
  @IsString() @MaxLength(120) name: string;
  @IsArray() @IsMongoId({ each: true }) memberIds: string[];
}
class MoveDto {
  @IsMongoId() fileId: string;
  @IsMongoId() folderId: string;
}
class FolderAccessDto { @IsArray() @IsMongoId({ each: true }) memberIds: string[]; }
@UseGuards(AuthGuard, RolesGuard)
@Controller('workspace-files')
export class WorkspaceFilesController {
  constructor(private s: WorkspaceFilesService) {}
  private manager(u: AuthenticatedUser) {
    return [UserRole.Administrator, UserRole.HR, 'ADMIN' as UserRole].includes(
      u.role as UserRole,
    );
  }
  @Get()
  @Roles(UserRole.Administrator, UserRole.HR, UserRole.Office, UserRole.User)
  list(@CurrentUser() u: AuthenticatedUser) {
    return this.s.list(u.userId, this.manager(u));
  }
  @Post('folders') @Roles(UserRole.Administrator, UserRole.HR) folder(
    @Body() d: FolderDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.s.createFolder(d.name, d.memberIds, u.userId);
  }
  @Post('upload')
  @Roles(UserRole.Administrator, UserRole.HR)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('folderId') folderId: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Select a file to upload');
    return this.s.upload(file, folderId, u.userId, this.manager(u));
  }
  @Patch('folders/:id/access') @Roles(UserRole.Administrator, UserRole.HR) access(
    @Param('id') id: string,
    @Body() d: FolderAccessDto,
  ) { return this.s.updateFolderAccess(id, d.memberIds); }
  @Patch('move') @Roles(UserRole.Administrator, UserRole.HR) move(
    @Body() d: MoveDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.s.move(d.fileId, d.folderId, u.userId, this.manager(u));
  }
}
