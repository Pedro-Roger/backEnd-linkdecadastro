import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class EventsRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findMany(args: Prisma.EventFindManyArgs): Promise<any[]> {
        return this.prisma.event.findMany(args);
    }

    async findFirst(args: Prisma.EventFindFirstArgs): Promise<any> {
        return this.prisma.event.findFirst(args);
    }

    async findUnique(args: Prisma.EventFindUniqueArgs): Promise<any> {
        return this.prisma.event.findUnique(args);
    }

    async create(args: Prisma.EventCreateArgs): Promise<any> {
        return this.prisma.event.create(args);
    }

    async update(args: Prisma.EventUpdateArgs): Promise<any> {
        return this.prisma.event.update(args);
    }

    async delete(args: Prisma.EventDeleteArgs): Promise<any> {
        return this.prisma.event.delete(args);
    }

    async count(args: Prisma.EventCountArgs): Promise<number> {
        return this.prisma.event.count(args);
    }

    async transaction<T>(fn: (prisma: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        return this.prisma.$transaction(fn);
    }
}
