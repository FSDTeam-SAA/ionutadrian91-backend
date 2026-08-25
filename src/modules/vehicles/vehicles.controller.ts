import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { UserRole } from '../../common/schemas';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { AssignEngineerDto } from './dto/assign-engineer.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { LocationHistoryQueryDto } from './dto/location-history-query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('Vehicles') @ApiBearerAuth() @UseGuards(AuthGuard, RolesGuard) @Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}
  @Post() @Roles(UserRole.Administrator, UserRole.HR) @ApiOperation({ summary: 'Create a vehicle' }) create(@Body() dto: CreateVehicleDto) { return this.vehicles.create(dto); }
  @Get('live') @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR) @ApiOperation({ summary: 'Get active vehicles with their latest mock locations' }) live() { return this.vehicles.getLiveVehicles(); }
  @Get('my-vehicle') @Roles(UserRole.User) @ApiOperation({ summary: 'Get the authenticated engineer’s assigned vehicle' }) mine(@CurrentUser() user: AuthenticatedUser) { return this.vehicles.getMyVehicle(user.userId); }
  @Get() @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR) findAll() { return this.vehicles.findAll(); }
  @Get(':id/location-history') @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR) history(@Param('id') id: string, @Query() query: LocationHistoryQueryDto) { return this.vehicles.getHistory(id, query); }
  @Get(':id/location') @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR, UserRole.User) location(@Param('id') id: string) { return this.vehicles.getLocation(id); }
  @Get(':id') @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR) findOne(@Param('id') id: string) { return this.vehicles.findOne(id); }
  @Patch(':id/assign-engineer') @Roles(UserRole.Administrator, UserRole.HR) assign(@Param('id') id: string, @Body() dto: AssignEngineerDto) { return this.vehicles.assignEngineer(id, dto.assignedEngineerId); }
  @Patch(':id') @Roles(UserRole.Administrator) update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) { return this.vehicles.update(id, dto); }
  @Delete(':id') @Roles(UserRole.Administrator) remove(@Param('id') id: string) { return this.vehicles.remove(id); }
}
