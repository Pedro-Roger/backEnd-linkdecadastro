import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

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

@UseGuards(JwtAuthGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly userService: UserService) { }

  @Get()
  async listUsers(
    @Req() req: any,
    @Query('state') state?: string,
    @Query('city') city?: string,
  ) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Acesso negado');
    }

    return this.userService.listAllUsers({
      state: state || undefined,
      city: city || undefined,
    });
  }

  @Patch(':userId/role')
  async updateUserRole(
    @Param('userId') userId: string,
    @Body('role') role: any, // Use any to allow string comparison before Prisma
    @Req() req: any,
  ) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Apenas o SUPER_ADMIN pode alterar papéis');
    }

    return this.userService.updateUserRole(userId, role);
  }

  @Post()
  async createUser(
    @Body()
    body: {
      name: string;
      email: string;
      password?: string;
      role: any;
    },
    @Req() req: any,
  ) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Apenas o SUPER_ADMIN pode criar novos usuários/administradores',
      );
    }

    return this.userService.createUser(body);
  }
}
