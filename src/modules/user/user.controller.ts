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
import { AuthGuard } from '../../common/guards/auth.guard';
import {
  ApiArrayResponseDecorator,
  ApiResponseDecorator,
} from '../../common/decorators';
import { UserRole } from '../../common/schemas';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';
import { UserService } from './user.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiResponseDecorator(200, 'Own profile retrieved', UserEntity)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.findOne(user.userId);
  }

  @Patch('me')
  @ApiResponseDecorator(200, 'Own profile updated', UserEntity)
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateOwnProfile(user.userId, dto);
  }

  @Post()
  @Roles(UserRole.Administrator)
  @ApiResponseDecorator(201, 'User created', UserEntity)
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get()
  @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR)
  @ApiArrayResponseDecorator(200, 'Users retrieved', UserEntity)
  findAll(@Query() query: ListUsersDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.Administrator, UserRole.Office, UserRole.HR)
  @ApiResponseDecorator(200, 'User retrieved', UserEntity)
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.Administrator)
  @ApiResponseDecorator(200, 'User updated', UserEntity)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.Administrator)
  @ApiResponseDecorator(200, 'User deactivated')
  deactivate(@Param('id') id: string) {
    return this.userService.deactivate(id);
  }
}
