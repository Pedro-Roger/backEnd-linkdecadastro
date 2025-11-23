import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.userService.getProfile(req.user.id);
  }

  @Patch('profile')
  async updateProfile(
    @Req() req: any,
    @Body()
    body: {
      name: string;
      bio?: string;
      avatar?: string;
      schoolOrUniversity?: string;
      hectares?: number;
      waterArea?: number;
      ponds?: number;
    },
  ) {
    return this.userService.updateProfile(req.user.id, body);
  }

  @Post('complete-profile')
  async completeProfile(
    @Req() req: any,
    @Body()
    body: {
      fullName: string;
      phone: string;
      cpf: string;
    },
  ) {
    return this.userService.completeProfile(req.user.id, body);
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    return this.userService.getStats(req.user.id);
  }
}


