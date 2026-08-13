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
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/schemas';

@ApiTags('Incidents')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @Roles(UserRole.Administrator, UserRole.User, UserRole.Office, UserRole.HR)
  @ApiOperation({ summary: 'Submit a new incident report' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateIncidentDto })
  @UseInterceptors(FileInterceptor('photo'))
  create(
    @Request() req: any,
    @Body('location') locationRaw: any,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let location = locationRaw;
    if (typeof locationRaw === 'string') {
      try {
        location = JSON.parse(locationRaw);
      } catch (e) {}
    }
    const dto: CreateIncidentDto = {
      ...body,
      location,
    };
    return this.incidentsService.create(req.user.userId, dto, file);
  }

  @Get('dashboard')
  @Roles(UserRole.Administrator, UserRole.HR)
  @ApiOperation({ summary: 'Get total incidents in each status (Admin/HR)' })
  getDashboardStats() {
    return this.incidentsService.getDashboardStats();
  }

  @Get()
  @Roles(UserRole.Administrator, UserRole.HR)
  @ApiOperation({ summary: 'Get all incident reports with filters (Admin/HR)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.incidentsService.findAll({ startDate, endDate, projectId, status });
  }

  @Get(':id')
  @Roles(UserRole.Administrator, UserRole.HR)
  @ApiOperation({ summary: 'Get an incident report by ID' })
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Update incident status and investigation details (Admin only)' })
  update(@Param('id') id: string, @Body() updateIncidentDto: UpdateIncidentDto) {
    return this.incidentsService.update(id, updateIncidentDto);
  }

  @Delete(':id')
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Delete an incident report (Admin only)' })
  remove(@Param('id') id: string) {
    return this.incidentsService.remove(id);
  }
}
