import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findMany(args: Prisma.UserFindManyArgs): Promise<any[]> {
        return this.prisma.user.findMany(args);
    }

    async findUnique(args: Prisma.UserFindUniqueArgs): Promise<any> {
        return this.prisma.user.findUnique(args);
    }

    async findFirst(args: Prisma.UserFindFirstArgs): Promise<any> {
        return this.prisma.user.findFirst(args);
    }

    async create(args: Prisma.UserCreateArgs): Promise<any> {
        return this.prisma.user.create(args);
    }

    async update(args: Prisma.UserUpdateArgs): Promise<any> {
        return this.prisma.user.update(args);
    }

    async delete(args: Prisma.UserDeleteArgs): Promise<any> {
        return this.prisma.user.delete(args);
    }

    async count(args: Prisma.UserCountArgs): Promise<number> {
        return this.prisma.user.count(args);
    }
}
