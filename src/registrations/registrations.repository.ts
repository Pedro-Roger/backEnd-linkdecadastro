import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class RegistrationsRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findMany(args: Prisma.RegistrationFindManyArgs): Promise<any[]> {
        return this.prisma.registration.findMany(args);
    }

    async findUnique(args: Prisma.RegistrationFindUniqueArgs): Promise<any> {
        return this.prisma.registration.findUnique(args);
    }

    async findFirst(args: Prisma.RegistrationFindFirstArgs): Promise<any> {
        return this.prisma.registration.findFirst(args);
    }

    async create(args: Prisma.RegistrationCreateArgs): Promise<any> {
        return this.prisma.registration.create(args);
    }

    async update(args: Prisma.RegistrationUpdateArgs): Promise<any> {
        return this.prisma.registration.update(args);
    }

    async delete(args: Prisma.RegistrationDeleteArgs): Promise<any> {
        return this.prisma.registration.delete(args);
    }

    async count(args: Prisma.RegistrationCountArgs): Promise<number> {
        return this.prisma.registration.count(args);
    }
}
