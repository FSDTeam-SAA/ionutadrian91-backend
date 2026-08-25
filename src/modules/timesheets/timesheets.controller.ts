import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole, TimesheetStatus } from '../../common/schemas';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CreateRateCardDto, UpdateRateCardDto } from './dto/rate-card.dto';
import { CreateTimesheetDto, ListTimesheetsQueryDto, UpdateTimesheetStatusDto } from './dto/timesheet.dto';
import { TimesheetsService } from './timesheets.service';

@ApiTags('Timesheets') @ApiBearerAuth() @UseGuards(AuthGuard, RolesGuard) @Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly service: TimesheetsService) {}
  @Get('rate-cards/active') @Roles(UserRole.User) activeRateCards() { return this.service.listRateCards('', 'true'); }
  @Get('rate-cards') @Roles(UserRole.Administrator, UserRole.HR) listRateCards(@Query('search') search?: string, @Query('isActive') isActive?: string) { return this.service.listRateCards(search, isActive); }
  @Post('rate-cards') @Roles(UserRole.Administrator, UserRole.HR) createRateCard(@Body() dto: CreateRateCardDto) { return this.service.createRateCard(dto); }
  @Patch('rate-cards/:id') @Roles(UserRole.Administrator) updateRateCard(@Param('id') id: string, @Body() dto: UpdateRateCardDto) { return this.service.updateRateCard(id, dto); }
  @Delete('rate-cards/:id') @Roles(UserRole.Administrator) removeRateCard(@Param('id') id: string) { return this.service.removeRateCard(id); }
  @Post() @Roles(UserRole.User) create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTimesheetDto) { return this.service.createForEngineer(user.userId, dto); }
  @Get('my') @Roles(UserRole.User) listOwn(@CurrentUser() user: AuthenticatedUser, @Query() query: ListTimesheetsQueryDto) { return this.service.listOwn(user.userId, query); }
  @Get('my/:id') @Roles(UserRole.User) findOwn(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.findOwn(user.userId, id); }
  @Patch(':id') @Roles(UserRole.User) updateOwn(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateTimesheetDto) { return this.service.updateOwn(user.userId, id, dto); }
  @Patch(':id/submit') @Roles(UserRole.User) submitOwn(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.submitOwn(user.userId, id); }
  @Get() @Roles(UserRole.Administrator, UserRole.HR) list(@Query() query: ListTimesheetsQueryDto) { return this.service.list(query); }
  @Get(':id') @Roles(UserRole.Administrator, UserRole.HR) findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Patch(':id/status') @Roles(UserRole.Administrator, UserRole.HR) updateStatus(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTimesheetStatusDto) { return this.service.updateStatus(id, dto.status, user.userId, dto.rejectionReason); }
}
