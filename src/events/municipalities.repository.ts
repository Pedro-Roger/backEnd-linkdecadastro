import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MunicipalitiesRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findManyLimits(args: Prisma.MunicipalityLimitFindManyArgs): Promise<any[]> {
        return this.prisma.municipalityLimit.findMany(args);
    }

    async findUniqueLimit(args: Prisma.MunicipalityLimitFindUniqueArgs): Promise<any> {
        return this.prisma.municipalityLimit.findUnique(args);
    }

    async findFirstLimit(args: Prisma.MunicipalityLimitFindFirstArgs): Promise<any> {
        return this.prisma.municipalityLimit.findFirst(args);
    }

    async updateLimit(args: Prisma.MunicipalityLimitUpdateArgs): Promise<any> {
        return this.prisma.municipalityLimit.update(args);
    }

    async findUniqueClass(args: Prisma.MunicipalityClassFindUniqueArgs): Promise<any> {
        return this.prisma.municipalityClass.findUnique(args);
    }

    async updateClass(args: Prisma.MunicipalityClassUpdateArgs): Promise<any> {
        return this.prisma.municipalityClass.update(args);
    }
}
