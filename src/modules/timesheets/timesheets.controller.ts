import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole, TimesheetStatus } from '../../common/schemas';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CreateRateCardDto, UpdateRateCardDto } from './dto/rate-card.dto';
import {
  CreateTimesheetDto,
  CreateTimesheetUnlockRequestDto,
  ListTimesheetsQueryDto,
  UpdateTimesheetStatusDto,
  UpdateTimesheetUnlockRequestDto,
} from './dto/timesheet.dto';
import { TimesheetsService } from './timesheets.service';

@ApiTags('Timesheets')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly service: TimesheetsService) {}
  @Get('rate-cards/active') @Roles(UserRole.User) activeRateCards() {
    return this.service.listRateCards('', 'true');
  }
  @Get('rate-cards') @Roles(UserRole.Administrator, UserRole.HR) listRateCards(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.listRateCards(search, isActive);
  }
  @Post('rate-cards')
  @Roles(UserRole.Administrator, UserRole.HR)
  createRateCard(@Body() dto: CreateRateCardDto) {
    return this.service.createRateCard(dto);
  }
  @Patch('rate-cards/:id') @Roles(UserRole.Administrator) updateRateCard(
    @Param('id') id: string,
    @Body() dto: UpdateRateCardDto,
  ) {
    return this.service.updateRateCard(id, dto);
  }
  @Delete('rate-cards/:id') @Roles(UserRole.Administrator) removeRateCard(
    @Param('id') id: string,
  ) {
    return this.service.removeRateCard(id);
  }
  @Post() @Roles(UserRole.User) create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTimesheetDto,
  ) {
    return this.service.createForEngineer(user.userId, dto);
  }
  @Get('my/eligible') @Roles(UserRole.User) eligibleOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Query('claimDate') claimDate?: string,
  ) {
    return this.service.eligibleOwn(user.userId, claimDate);
  }
  @Get('engineers') @Roles(UserRole.User) listEngineers() {
    return this.service.listEngineers();
  }
  @Post('my/eligible/:assignmentId/members')
  @Roles(UserRole.User)
  addTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId') assignmentId: string,
    @Body('memberId') memberId: string,
  ) {
    return this.service.addTeamMember(user.userId, assignmentId, memberId);
  }
  @Delete('my/eligible/:assignmentId/members/:memberId')
  @Roles(UserRole.User)
  removeTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId') assignmentId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.service.removeTeamMember(user.userId, assignmentId, memberId);
  }
  @Post('my/unlock-requests') @Roles(UserRole.User) requestUnlock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTimesheetUnlockRequestDto,
  ) {
    return this.service.requestUnlock(user.userId, dto);
  }
  @Get('my') @Roles(UserRole.User) listOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTimesheetsQueryDto,
  ) {
    return this.service.listOwn(user.userId, query);
  }
  @Get('my/:id') @Roles(UserRole.User) findOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.findOwn(user.userId, id);
  }
  @Patch(':id') @Roles(UserRole.User) updateOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateTimesheetDto,
  ) {
    return this.service.updateOwn(user.userId, id, dto);
  }
  @Patch(':id/submit') @Roles(UserRole.User) submitOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.submitOwn(user.userId, id);
  }
  @Get('unlock-requests')
  @Roles(UserRole.Administrator, UserRole.HR)
  listUnlockRequests(@Query('status') status?: any) {
    return this.service.listUnlockRequests(status);
  }
  @Patch('unlock-requests/:id')
  @Roles(UserRole.Administrator, UserRole.HR)
  reviewUnlockRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTimesheetUnlockRequestDto,
  ) {
    return this.service.reviewUnlockRequest(id, dto.status, user.userId);
  }
  @Get() @Roles(UserRole.Administrator, UserRole.HR) list(
    @Query() query: ListTimesheetsQueryDto,
  ) {
    return this.service.list(query);
  }
  @Get(':id') @Roles(UserRole.Administrator, UserRole.HR) findOne(
    @Param('id') id: string,
  ) {
    return this.service.findOne(id);
  }
  @Patch(':id/status') @Roles(UserRole.Administrator, UserRole.HR) updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTimesheetStatusDto,
  ) {
    return this.service.updateStatus(
      id,
      dto.status,
      user.userId,
      dto.rejectionReason,
    );
  }
}
