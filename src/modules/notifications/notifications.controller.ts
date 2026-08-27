import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/schemas';
import { NotificationsService } from './notifications.service';

@UseGuards(AuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('admin-pending')
  @Roles(UserRole.Administrator, UserRole.HR)
  getAdminPendingActions() {
    return this.notifications.getAdminPendingActions();
  }
}
