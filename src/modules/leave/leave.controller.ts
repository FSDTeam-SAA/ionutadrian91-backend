import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/schemas';

@ApiTags('Leave Management')
@ApiBearerAuth()
@Controller('leave')
@UseGuards(AuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post('apply')
  @ApiOperation({ summary: 'Apply for leave (Employee)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async applyLeave(
    @Request() req: any,
    @Body() dto: ApplyLeaveDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.leaveService.applyLeave(req.user.userId, dto, file);
  }

  @Get('my-history')
  @ApiOperation({ summary: 'View my leave balance and history (Employee)' })
  async getMyHistory(@Request() req: any) {
    return this.leaveService.getMyHistory(req.user.userId);
  }

  @Get('dashboard')
  @Roles(UserRole.Administrator, UserRole.HR)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get total, pending, and approved requests (Admin/Manager)' })
  async getDashboardStats() {
    return this.leaveService.getDashboardStats();
  }

  @Get('calendar')
  @Roles(UserRole.Administrator, UserRole.HR)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get employees on leave by month and year for calendar (Admin/Manager)' })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  async getCalendar(@Query('month') month?: string, @Query('year') year?: string) {
    const m = month ? parseInt(month, 10) : undefined;
    const y = year ? parseInt(year, 10) : undefined;
    return this.leaveService.getCalendar(m, y);
  }

  @Get()
  @Roles(UserRole.Administrator, UserRole.HR)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get all requests with filters (Admin/Manager)' })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'employeeName', required: false })
  async getAllRequests(
    @Query('departmentId') departmentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    return this.leaveService.getAllRequests({
      departmentId,
      startDate,
      endDate,
      employeeName,
    });
  }

  @Patch(':id/status')
  @Roles(UserRole.Administrator, UserRole.HR)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Approve or reject a leave request (Admin/Manager)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveStatusDto,
  ) {
    return this.leaveService.updateStatus(id, dto);
  }
}
