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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DutyOfCareService } from './duty-of-care.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/schemas';

@ApiTags('Duty Of Care (Time Tracking)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('duty-of-care')
export class DutyOfCareController {
  constructor(private readonly dutyOfCareService: DutyOfCareService) {}

  @Post('clock-in')
  @Roles(UserRole.Administrator, UserRole.HR, UserRole.User, UserRole.Office)
  @ApiOperation({ summary: 'Employee clocks in (Starts work)' })
  clockIn(@Request() req: any, @Body() clockInDto: ClockInDto) {
    return this.dutyOfCareService.clockIn(req.user.userId, clockInDto);
  }

  @Patch(':id/clock-out')
  @Roles(UserRole.Administrator, UserRole.HR, UserRole.User, UserRole.Office)
  @ApiOperation({ summary: 'Employee clocks out (Ends work)' })
  clockOut(@Request() req: any, @Param('id') id: string, @Body() clockOutDto: ClockOutDto) {
    return this.dutyOfCareService.clockOut(req.user.userId, id, clockOutDto);
  }

  @Get('my-records')
  @Roles(UserRole.Administrator, UserRole.HR, UserRole.User, UserRole.Office)
  @ApiOperation({ summary: 'Get current user duty of care records' })
  getMyRecords(@Request() req: any) {
    return this.dutyOfCareService.findMyRecords(req.user.userId);
  }

  @Get()
  @Roles(UserRole.Administrator, UserRole.HR)
  @ApiOperation({ summary: 'Get all duty of care records (Admin/HR)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'teamMemberId', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('teamMemberId') teamMemberId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.dutyOfCareService.findAll({ startDate, endDate, teamMemberId, projectId });
  }

  @Get(':id')
  @Roles(UserRole.Administrator, UserRole.HR)
  @ApiOperation({ summary: 'Get a specific duty of care record (Admin/HR)' })
  findOne(@Param('id') id: string) {
    return this.dutyOfCareService.findOne(id);
  }

  @Delete(':id')
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Delete a duty of care record (Admin only)' })
  remove(@Param('id') id: string) {
    return this.dutyOfCareService.remove(id);
  }
}
