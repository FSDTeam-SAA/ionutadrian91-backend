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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { WhereaboutsService } from './whereabouts.service';
import { CreateWhereaboutsDto } from './dto/create-whereabouts.dto';
import { UpdateWhereaboutsDto } from './dto/update-whereabouts.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/schemas';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';

@ApiTags('Whereabouts (Task Assignments)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('whereabouts')
export class WhereaboutsController {
  constructor(private readonly whereaboutsService: WhereaboutsService) {}

  @Post()
  @Roles(UserRole.Administrator, UserRole.HR)
  @ApiOperation({
    summary: 'Create a new task assignment (Administrator or HR)',
  })
  create(@Body() createWhereaboutsDto: CreateWhereaboutsDto) {
    return this.whereaboutsService.create(createWhereaboutsDto);
  }

  @Get('calendar')
  @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR)
  @ApiOperation({ summary: 'Get total assignments for calendar view' })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getCalendar(@Query('month') month?: number, @Query('year') year?: number, @Query('memberId') memberId?: string) {
    return this.whereaboutsService.getCalendar(month, year, memberId);
  }

  @Get()
  @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR)
  @ApiOperation({ summary: 'Get all task assignments with filters' })
  @ApiQuery({ name: 'title', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findAll(
    @Query('title') title?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.whereaboutsService.findAll({ title, startDate, endDate });
  }

  @Get('mine')
  @Roles(UserRole.Administrator, UserRole.HR, UserRole.Office, UserRole.User)
  @ApiOperation({ summary: 'Get task assignments for the current team member' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.whereaboutsService.findMine(user.userId);
  }

  @Get(':id')
  @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR)
  @ApiOperation({ summary: 'Get a task assignment by ID' })
  findOne(@Param('id') id: string) {
    return this.whereaboutsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.Administrator, UserRole.HR)
  @ApiOperation({ summary: 'Update a task assignment (Administrator or HR)' })
  update(
    @Param('id') id: string,
    @Body() updateWhereaboutsDto: UpdateWhereaboutsDto,
  ) {
    return this.whereaboutsService.update(id, updateWhereaboutsDto);
  }

  @Delete(':id')
  @Roles(UserRole.Administrator, UserRole.HR)
  @ApiOperation({ summary: 'Delete a task assignment (Administrator or HR)' })
  remove(@Param('id') id: string) {
    return this.whereaboutsService.remove(id);
  }
}
