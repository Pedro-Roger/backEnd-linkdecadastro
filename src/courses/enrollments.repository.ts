import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class EnrollmentsRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findMany(args: Prisma.EnrollmentFindManyArgs): Promise<any[]> {
        return this.prisma.enrollment.findMany(args);
    }

    async findFirst(args: Prisma.EnrollmentFindFirstArgs): Promise<any> {
        return this.prisma.enrollment.findFirst(args);
    }

    async findUnique(args: Prisma.EnrollmentFindUniqueArgs): Promise<any> {
        return this.prisma.enrollment.findUnique(args);
    }

    async create(args: Prisma.EnrollmentCreateArgs): Promise<any> {
        return this.prisma.enrollment.create(args);
    }

    async update(args: Prisma.EnrollmentUpdateArgs): Promise<any> {
        return this.prisma.enrollment.update(args);
    }

    async delete(args: Prisma.EnrollmentDeleteArgs): Promise<any> {
        return this.prisma.enrollment.delete(args);
    }

    async count(args: Prisma.EnrollmentCountArgs): Promise<number> {
        return this.prisma.enrollment.count(args);
    }
}
