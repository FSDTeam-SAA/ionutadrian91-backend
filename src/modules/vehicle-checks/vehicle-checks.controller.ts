import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { UserRole } from '../../common/schemas';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { ResolveVehicleDefectDto, SubmitVehicleCheckDto, VehicleChecksQueryDto } from './dto/vehicle-check.dto';
import { VehicleChecksService } from './vehicle-checks.service';

@ApiTags('Vehicle checks') @ApiBearerAuth() @UseGuards(AuthGuard, RolesGuard) @Controller('vehicle-checks')
export class VehicleChecksController {
  constructor(private readonly checks: VehicleChecksService) {}
  @Get('mine/due') @Roles(UserRole.User) due(@CurrentUser() user: AuthenticatedUser, @Query('vehicleId') vehicleId?: string) { return this.checks.dueState(user.userId, vehicleId); }
  @Get('mine') @Roles(UserRole.User) mine(@CurrentUser() user: AuthenticatedUser, @Query() query: VehicleChecksQueryDto) { return this.checks.mine(user.userId, query); }
  @Get('mine/:id') @Roles(UserRole.User) mineOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.checks.mineOne(id, user.userId); }
  @Post('upload') @Roles(UserRole.User) @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } })) upload(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) { return this.checks.upload(user.userId, file); }
  @Post() @Roles(UserRole.User) submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitVehicleCheckDto) { return this.checks.submit(user.userId, dto); }
  @Get('overdue/summary') @Roles(UserRole.Administrator, UserRole.HR) overdue() { return this.checks.overdueSummary(); }
  @Get() @Roles(UserRole.Administrator, UserRole.HR) list(@Query() query: VehicleChecksQueryDto) { return this.checks.list(query); }
  @Get(':id') @Roles(UserRole.Administrator, UserRole.HR) detail(@Param('id') id: string) { return this.checks.detail(id); }
  @Patch(':id/acknowledge') @Roles(UserRole.Administrator, UserRole.HR) acknowledge(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.checks.acknowledge(id, user.userId); }
  @Patch(':id/resolve') @Roles(UserRole.Administrator, UserRole.HR) resolve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: ResolveVehicleDefectDto) { return this.checks.resolve(id, user.userId, dto); }
}
