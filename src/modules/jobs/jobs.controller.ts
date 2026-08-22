import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { UserRole } from '../../common/schemas';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobsService } from './jobs.service';

@ApiTags('Jobs') @ApiBearerAuth() @UseGuards(AuthGuard, RolesGuard) @Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}
  @Post() @Roles(UserRole.Administrator, UserRole.HR) create(@Body() dto: CreateJobDto) { return this.jobs.create(dto); }
  @Get() @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR) async list(@Query() query: ListJobsQueryDto) { return (await this.jobs.findAll(query)).data; }
  @Get('mine') @Roles(UserRole.User) async mine(@Query() query: ListJobsQueryDto, @CurrentUser() user: AuthenticatedUser) { return (await this.jobs.findAll(query, user.userId)).data; }
  @Get(':id') @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR) get(@Param('id') id: string) { return this.jobs.findOne(id); }
  @Get(':id/mine') @Roles(UserRole.User) mineOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.jobs.findOne(id, user.userId); }
  @Patch(':id') @Roles(UserRole.Administrator, UserRole.HR) update(@Param('id') id: string, @Body() dto: UpdateJobDto) { return this.jobs.update(id, dto); }
  @Delete(':id') @Roles(UserRole.Administrator) remove(@Param('id') id: string) { return this.jobs.remove(id); }
}
