import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ApiResponseDecorator } from '../../common/decorators';
import { THROTTLER_CONFIG } from '../../common/config/throttler.config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  AuthResponseDto,
  PublicUserDto,
  RegisterResponseDto,
} from './dto/auth-response.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ClientPlatform } from './interfaces/auth.interface';
import type { AuthenticatedUser } from './interfaces/auth.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({
    default: {
      limit: THROTTLER_CONFIG.STRICT.limit,
      ttl: THROTTLER_CONFIG.STRICT.ttl,
      blockDuration: THROTTLER_CONFIG.STRICT.ttl,
    },
  })
  @ApiResponseDecorator(201, 'Field user registered', RegisterResponseDto)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @Throttle({
    default: {
      limit: THROTTLER_CONFIG.STRICT.limit,
      ttl: THROTTLER_CONFIG.STRICT.ttl,
      blockDuration: THROTTLER_CONFIG.STRICT.ttl,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponseDecorator(200, 'Email verified')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('login')
  @Throttle({
    default: {
      limit: THROTTLER_CONFIG.AUTH.limit,
      ttl: THROTTLER_CONFIG.AUTH.ttl,
      blockDuration: THROTTLER_CONFIG.AUTH.ttl,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponseDecorator(200, 'User logged in', AuthResponseDto)
  login(
    @Body() dto: LoginDto,
    @Headers('x-client-platform') platform?: ClientPlatform,
  ) {
    return this.authService.login({
      ...dto,
      clientPlatform: dto.clientPlatform || platform || ClientPlatform.Web,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiResponseDecorator(200, 'Tokens refreshed')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('forgot-password')
  @Throttle({
    default: {
      limit: THROTTLER_CONFIG.STRICT.limit,
      ttl: THROTTLER_CONFIG.STRICT.ttl,
      blockDuration: THROTTLER_CONFIG.STRICT.ttl,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponseDecorator(200, 'Password reset OTP sent when account exists')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('resend-otp')
  @Throttle({
    default: {
      limit: THROTTLER_CONFIG.STRICT.limit,
      ttl: THROTTLER_CONFIG.STRICT.ttl,
      blockDuration: THROTTLER_CONFIG.STRICT.ttl,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponseDecorator(200, 'OTP resent')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('change-password')
  @Throttle({
    default: {
      limit: THROTTLER_CONFIG.STRICT.limit,
      ttl: THROTTLER_CONFIG.STRICT.ttl,
      blockDuration: THROTTLER_CONFIG.STRICT.ttl,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponseDecorator(200, 'Password changed')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiResponseDecorator(200, 'User logged out')
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Partial<RefreshTokenDto>,
  ) {
    return this.authService.logout(user.userId, dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiResponseDecorator(200, 'User logged out from all devices')
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user.userId);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiResponseDecorator(200, 'Password changed')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, dto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiResponseDecorator(200, 'Current user retrieved', PublicUserDto)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.userId);
  }
}
