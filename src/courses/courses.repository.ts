import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CoursesRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findMany(args: Prisma.CourseFindManyArgs): Promise<any[]> {
        return this.prisma.course.findMany(args);
    }

    async findFirst(args: Prisma.CourseFindFirstArgs): Promise<any> {
        return this.prisma.course.findFirst(args);
    }

    async findUnique(args: Prisma.CourseFindUniqueArgs): Promise<any> {
        return this.prisma.course.findUnique(args);
    }

    async create(args: Prisma.CourseCreateArgs): Promise<any> {
        return this.prisma.course.create(args);
    }

    async update(args: Prisma.CourseUpdateArgs): Promise<any> {
        return this.prisma.course.update(args);
    }

    async delete(args: Prisma.CourseDeleteArgs): Promise<any> {
        return this.prisma.course.delete(args);
    }

    async count(args: Prisma.CourseCountArgs): Promise<number> {
        return this.prisma.course.count(args);
    }
}
