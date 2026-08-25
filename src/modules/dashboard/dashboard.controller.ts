import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { UserRole } from '../../common/schemas';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Get live admin dashboard overview' })
  overview() {
    return this.dashboard.getOverview();
  }

  @Get('my-overview')
  @Roles(UserRole.User)
  @ApiOperation({ summary: 'Get the authenticated engineer dashboard overview' })
  myOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getEngineerOverview(user.userId);
  }
}
