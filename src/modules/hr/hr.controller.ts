import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiArrayResponseDecorator,
  ApiResponseDecorator,
} from '../../common/decorators';
import { AuthGuard } from '../../common/guards/auth.guard';
import { UserRole } from '../../common/schemas';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { ListPlansDto } from './dto/list-plans.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { DepartmentEntity } from './entities/department.entity';
import { PlanEntity } from './entities/plan.entity';
import { TeamMemberEntity } from './entities/team-member.entity';
import { HrService, type UploadedPhoto } from './hr.service';

@ApiTags('HR')
@ApiBearerAuth()
@Controller('hr')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.HR, UserRole.Administrator)
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Post('departments')
  @ApiOperation({
    summary: 'Create a department',
    description:
      'Creates a department and assigns an existing user as its head.',
  })
  @ApiResponseDecorator(201, 'Department created', DepartmentEntity)
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.hrService.createDepartment(dto);
  }

  @Get('departments')
  @ApiOperation({ summary: 'List departments' })
  @ApiArrayResponseDecorator(200, 'Departments retrieved', DepartmentEntity)
  findAllDepartments() {
    return this.hrService.findAllDepartments();
  }

  @Get('departments/:id')
  @ApiOperation({ summary: 'Get a department' })
  @ApiParam({ name: 'id', description: 'Department ID' })
  @ApiResponseDecorator(200, 'Department retrieved', DepartmentEntity)
  findDepartment(@Param('id') id: string) {
    return this.hrService.findDepartment(id);
  }

  @Patch('departments/:id')
  @ApiOperation({ summary: 'Update a department' })
  @ApiParam({ name: 'id', description: 'Department ID' })
  @ApiResponseDecorator(200, 'Department updated', DepartmentEntity)
  updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.hrService.updateDepartment(id, dto);
  }

  @Delete('departments/:id')
  @ApiOperation({
    summary: 'Delete a department',
    description: 'A department with existing plans cannot be deleted.',
  })
  @ApiParam({ name: 'id', description: 'Department ID' })
  @ApiResponseDecorator(200, 'Department deleted')
  removeDepartment(@Param('id') id: string) {
    return this.hrService.removeDepartment(id);
  }

  @Post('team-members')
  @ApiOperation({ summary: 'Add a team member' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateTeamMemberDto })
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiResponseDecorator(201, 'Team member created', TeamMemberEntity)
  createTeamMember(
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^(image\/png|image\/jpeg)$/ }),
        ],
      }),
    )
    photo: UploadedPhoto | undefined,
    @Body() dto: CreateTeamMemberDto,
  ) {
    return this.hrService.createTeamMember(dto, photo);
  }

  @Get('team-members')
  @ApiOperation({ summary: 'List team members' })
  @ApiArrayResponseDecorator(200, 'Team members retrieved', TeamMemberEntity)
  findAllTeamMembers() {
    return this.hrService.findAllTeamMembers();
  }

  @Get('team-members/:id/photo')
  @ApiOperation({ summary: 'Get a team member photo' })
  @ApiParam({ name: 'id', description: 'Team member ID' })
  getTeamMemberPhoto(@Param('id') id: string, @Res() response: Response) {
    return this.hrService
      .findTeamMemberPhoto(id)
      .then((photo) => response.type(photo.mimeType).send(photo.data));
  }

  @Get('team-members/:id')
  @ApiOperation({ summary: 'Get a team member' })
  @ApiParam({ name: 'id', description: 'Team member ID' })
  @ApiResponseDecorator(200, 'Team member retrieved', TeamMemberEntity)
  findTeamMember(@Param('id') id: string) {
    return this.hrService.findTeamMember(id);
  }

  @Patch('team-members/:id')
  @ApiOperation({ summary: 'Update a team member' })
  @ApiParam({ name: 'id', description: 'Team member ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateTeamMemberDto })
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiResponseDecorator(200, 'Team member updated', TeamMemberEntity)
  updateTeamMember(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^(image\/png|image\/jpeg)$/ }),
        ],
      }),
    )
    photo: UploadedPhoto | undefined,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.hrService.updateTeamMember(id, dto, photo);
  }

  @Delete('team-members/:id')
  @ApiOperation({ summary: 'Delete a team member' })
  @ApiParam({ name: 'id', description: 'Team member ID' })
  @ApiResponseDecorator(200, 'Team member deleted')
  removeTeamMember(@Param('id') id: string) {
    return this.hrService.removeTeamMember(id);
  }

  @Post('plans')
  @ApiOperation({
    summary: 'Create a plan',
    description:
      'Creates a department plan and records the authenticated user as its creator.',
  })
  @ApiResponseDecorator(201, 'Plan created', PlanEntity)
  createPlan(
    @Body() dto: CreatePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hrService.createPlan(dto, user.userId);
  }

  @Get('plans')
  @ApiOperation({
    summary: 'List plans',
    description: 'Filter plans by department or status.',
  })
  @ApiResponseDecorator(200, 'Plans retrieved')
  findAllPlans(@Query() query: ListPlansDto) {
    return this.hrService.findAllPlans(query);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get a plan' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponseDecorator(200, 'Plan retrieved', PlanEntity)
  findPlan(@Param('id') id: string) {
    return this.hrService.findPlan(id);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Update a plan' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponseDecorator(200, 'Plan updated', PlanEntity)
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.hrService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @ApiOperation({ summary: 'Delete a plan' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponseDecorator(200, 'Plan deleted')
  removePlan(@Param('id') id: string) {
    return this.hrService.removePlan(id);
  }
}
