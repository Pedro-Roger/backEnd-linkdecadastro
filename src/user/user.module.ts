import { Module } from '@nestjs/common';
import { UserController, AdminUsersController } from './user.controller';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [UserController, AdminUsersController],
  providers: [UserService, PrismaService],
})
export class UserModule {}
