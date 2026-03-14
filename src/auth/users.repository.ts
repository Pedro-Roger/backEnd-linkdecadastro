import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findMany(args: any): Promise<any[]> {
        return this.prisma.user.findMany(args);
    }

    async findUnique(args: any): Promise<any> {
        return this.prisma.user.findUnique(args);
    }

    async findFirst(args: any): Promise<any> {
        return this.prisma.user.findFirst(args);
    }

    async create(args: any): Promise<any> {
        return this.prisma.user.create(args);
    }

    async update(args: any): Promise<any> {
        return this.prisma.user.update(args);
    }

    async delete(args: any): Promise<any> {
        return this.prisma.user.delete(args);
    }

    async count(args: any): Promise<number> {
        return this.prisma.user.count(args);
    }
}
