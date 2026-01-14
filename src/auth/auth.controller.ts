import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  create(@Body() payload: CreateAuthDto, @Req() req: Request) {
    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      device:
        (Array.isArray(req.headers['x-device'])
          ? req.headers['x-device'][0]
          : req.headers['x-device']) ||
        (Array.isArray(req.headers['x-device-id'])
          ? req.headers['x-device-id'][0]
          : req.headers['x-device-id']) ||
        (Array.isArray(req.headers['sec-ch-ua-platform'])
          ? req.headers['sec-ch-ua-platform'][0]
          : req.headers['sec-ch-ua-platform']),
    };
    return this.authService.create(payload, meta);
  }

  @Get()
  findAll() {
    return this.authService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.authService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAuthDto: UpdateAuthDto) {
    return this.authService.update(+id, updateAuthDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authService.remove(+id);
  }
}
