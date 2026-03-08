import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InstanceServer, Prisma } from '@prisma/client';

export interface IInstancesServerRepository {
    create(data: Prisma.InstanceServerCreateInput): Promise<InstanceServer>;
    findAvailableInstance(type?: string): Promise<InstanceServer | null>;
    findById(id: string): Promise<InstanceServer | null>;
    findAll(params?: {
        skip?: number;
        take?: number;
        cursor?: Prisma.InstanceServerWhereUniqueInput;
        where?: Prisma.InstanceServerWhereInput;
        orderBy?: Prisma.InstanceServerOrderByWithRelationInput;
    }): Promise<InstanceServer[]>;
    update(params: {
        where: Prisma.InstanceServerWhereUniqueInput;
        data: Prisma.InstanceServerUpdateInput;
    }): Promise<InstanceServer>;
    delete(where: Prisma.InstanceServerWhereUniqueInput): Promise<InstanceServer>;
}

@Injectable()
export class InstancesServerRepository implements IInstancesServerRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: Prisma.InstanceServerCreateInput): Promise<InstanceServer> {
        return this.prisma.instanceServer.create({ data });
    }

    async findAvailableInstance(type: string = 'EVOLUTION'): Promise<InstanceServer | null> {
        const instances = await this.prisma.instanceServer.findMany({
            where: {
                status: 'active',
            },
            include: {
                _count: {
                    select: { chat_channels: true }
                }
            },
        });

        for (const instance of instances) {
            if (instance._count.chat_channels < instance.max_instances) {
                return instance;
            }
        }

        return null;
    }

    async findById(id: string): Promise<InstanceServer | null> {
        return this.prisma.instanceServer.findUnique({
            where: { id },
        });
    }

    async findAll(params?: {
        skip?: number;
        take?: number;
        cursor?: Prisma.InstanceServerWhereUniqueInput;
        where?: Prisma.InstanceServerWhereInput;
        orderBy?: Prisma.InstanceServerOrderByWithRelationInput;
    }): Promise<InstanceServer[]> {
        return this.prisma.instanceServer.findMany(params);
    }

    async update(params: {
        where: Prisma.InstanceServerWhereUniqueInput;
        data: Prisma.InstanceServerUpdateInput;
    }): Promise<InstanceServer> {
        return this.prisma.instanceServer.update(params);
    }

    async delete(where: Prisma.InstanceServerWhereUniqueInput): Promise<InstanceServer> {
        return this.prisma.instanceServer.update({
            where,
            data: { status: 'inactive' },
        });
    }
}
