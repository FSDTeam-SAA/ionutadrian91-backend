import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/schemas';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Create a new project' })
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR, UserRole.User)
  @ApiOperation({ summary: 'Get all projects with filters' })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'startDate', required: false, description: 'Created At Start Date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Created At End Date' })
  findAll(
    @Query('name') name?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.projectsService.findAll({ name, startDate, endDate });
  }

  @Get(':id')
  @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR, UserRole.User)
  @ApiOperation({ summary: 'Get a project by ID' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.Administrator, UserRole.Office)
  @ApiOperation({ summary: 'Update a project' })
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Delete a project' })
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
