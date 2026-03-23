import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CRM_PIPELINES_COLLECTION = 'crm_contact_pipelines';
const DEFAULT_STAGE = 'NOVO_LEAD';

@Injectable()
export class AdminCrmService {
    constructor(private readonly prisma: PrismaService) { }

    private readonly pipelineStages = [
        'NOVO_LEAD',
        'CONTATO_INICIAL',
        'QUALIFICACAO',
        'PROPOSTA',
        'NEGOCIACAO',
        'FECHADO',
        'PERDIDO',
    ];

    private async runCommand<T = any>(command: Record<string, unknown>): Promise<T> {
        return (this.prisma as any).$runCommandRaw(command);
    }

    private async findMany<T>(
        collection: string,
        filter: Record<string, unknown>,
        sort?: Record<string, 1 | -1>,
    ) {
        const result = await this.runCommand<{ cursor?: { firstBatch?: T[] } }>({
            find: collection,
            filter,
            sort: sort || { updated_at: -1 },
        });

        return result?.cursor?.firstBatch || [];
    }

    private async findOne<T>(collection: string, filter: Record<string, unknown>) {
        const items = await this.findMany<T>(collection, filter, { updated_at: -1 });
        return items[0] || null;
    }

    private async updateOne(
        collection: string,
        filter: Record<string, unknown>,
        $set: Record<string, unknown>,
        upsert = false,
    ) {
        await this.runCommand({
            update: collection,
            updates: [
                {
                    q: filter,
                    u: { $set },
                    upsert,
                    multi: false,
                },
            ],
        });
    }

    private assertAdmin(role?: string) {
        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Nao autorizado');
        }
    }

    private getOwnedWhereClause(
        userId: string,
        userRole: string | undefined,
        otherFilters: any = {},
    ) {
        if (userRole === 'SUPER_ADMIN') return otherFilters;
        return { ...otherFilters, createdBy: userId };
    }

    private normalizePhone(phone?: string | null) {
        return String(phone || '').replace(/\D/g, '');
    }

    private buildContactKey(contact: {
        id: string;
        type: 'USER' | 'GUEST';
        email?: string | null;
        phone?: string | null;
    }) {
        const email = String(contact.email || '').trim().toLowerCase();
        const phone = this.normalizePhone(contact.phone);

        if (phone) return `phone:${phone}`;
        if (email) return `email:${email}`;
        return `${contact.type.toLowerCase()}:${contact.id}`;
    }

    private getStageLabel(stage: string) {
        return stage
            .toLowerCase()
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    getPipelineStages() {
        return this.pipelineStages.map((stage) => ({
            key: stage,
            label: this.getStageLabel(stage),
        }));
    }

    async listAllContacts(userId: string, userRole?: string) {
        this.assertAdmin(userRole);

        const ownedEventsWhere = this.getOwnedWhereClause(userId, userRole);
        const ownedCoursesWhere = this.getOwnedWhereClause(userId, userRole);

        const pipelines = await this.findMany<any>(
            CRM_PIPELINES_COLLECTION,
            { owner_user_id: userId },
            { updated_at: -1 },
        );
        const pipelinesMap = new Map(
            pipelines.map((pipeline) => [pipeline.contact_key, pipeline]),
        );

        const usersWithEnrollments = await this.prisma.user.findMany({
            where: {
                enrollments: {
                    some: {
                        course: ownedCoursesWhere,
                    },
                },
            },
            include: {
                enrollments: {
                    where: {
                        course: ownedCoursesWhere,
                    },
                    include: {
                        course: {
                            select: { title: true },
                        },
                    },
                },
                registrations: {
                    where: {
                        event: ownedEventsWhere,
                    },
                    include: {
                        event: {
                            select: { title: true },
                        },
                    },
                },
            },
        });

        const registrations = await this.prisma.registration.findMany({
            where: {
                event: ownedEventsWhere,
                userId: null,
            },
            include: {
                event: {
                    select: { title: true },
                },
            },
        });

        const contactsMap = new Map<string, any>();

        usersWithEnrollments.forEach((user) => {
            const key = user.email || user.phone || user.id;
            const baseContact = {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                city: user.city,
                state: user.state,
                type: 'USER' as const,
                participantType: user.participantType,
                lastInteraction: user.updatedAt,
                source: [
                    ...user.enrollments.map((enrollment) => `Curso: ${enrollment.course.title}`),
                    ...user.registrations.map((registration) => `Evento: ${registration.event.title}`),
                ],
            };

            const pipeline = pipelinesMap.get(this.buildContactKey(baseContact));

            contactsMap.set(key, {
                ...baseContact,
                crmStage: pipeline?.stage || DEFAULT_STAGE,
                crmUpdatedAt: pipeline?.updated_at || user.updatedAt,
            });
        });

        registrations.forEach((registration) => {
            const key = registration.email || registration.phone || registration.id;
            if (contactsMap.has(key)) {
                contactsMap.get(key).source.push(`Evento: ${registration.event.title}`);
                return;
            }

            const baseContact = {
                id: registration.id,
                name: registration.name,
                email: registration.email,
                phone: registration.phone,
                city: registration.city,
                state: registration.state,
                type: 'GUEST' as const,
                participantType: registration.participantType,
                lastInteraction: registration.updatedAt,
                source: [`Evento: ${registration.event.title}`],
            };

            const pipeline = pipelinesMap.get(this.buildContactKey(baseContact));

            contactsMap.set(key, {
                ...baseContact,
                crmStage: pipeline?.stage || DEFAULT_STAGE,
                crmUpdatedAt: pipeline?.updated_at || registration.updatedAt,
            });
        });

        return Array.from(contactsMap.values()).sort(
            (a, b) =>
                new Date(b.lastInteraction).getTime() -
                new Date(a.lastInteraction).getTime(),
        );
    }

    async updateContactStage(
        userId: string,
        userRole: string | undefined,
        body: {
            contactId: string;
            type: 'USER' | 'GUEST';
            email?: string;
            phone?: string;
            stage: string;
        },
    ) {
        this.assertAdmin(userRole);

        if (!this.pipelineStages.includes(body.stage)) {
            throw new BadRequestException('Etapa do funil invalida.');
        }

        const contactKey = this.buildContactKey({
            id: body.contactId,
            type: body.type,
            email: body.email,
            phone: body.phone,
        });

        const now = new Date();
        const current = await this.findOne<any>(CRM_PIPELINES_COLLECTION, {
            owner_user_id: userId,
            contact_key: contactKey,
        });

        const next = {
            id: current?.id || `${userId}-${contactKey}`,
            owner_user_id: userId,
            contact_id: body.contactId,
            contact_type: body.type,
            contact_key: contactKey,
            email: body.email?.trim()?.toLowerCase() || null,
            phone: this.normalizePhone(body.phone) || null,
            stage: body.stage,
            created_at: current?.created_at || now,
            updated_at: now,
        };

        await this.updateOne(
            CRM_PIPELINES_COLLECTION,
            { owner_user_id: userId, contact_key: contactKey },
            next,
            true,
        );

        return {
            success: true,
            contactKey,
            stage: next.stage,
            stageLabel: this.getStageLabel(next.stage),
            updatedAt: next.updated_at,
        };
    }

    async getCrmStats(userId: string, userRole?: string) {
        this.assertAdmin(userRole);

        const ownedEventsWhere = this.getOwnedWhereClause(userId, userRole);
        const ownedCoursesWhere = this.getOwnedWhereClause(userId, userRole);

        const [totalCourses, totalEvents, totalRegistrations, totalEnrollments] =
            await Promise.all([
                this.prisma.course.count({ where: ownedCoursesWhere }),
                this.prisma.event.count({ where: ownedEventsWhere }),
                this.prisma.registration.count({
                    where: { event: ownedEventsWhere },
                }),
                this.prisma.enrollment.count({
                    where: { course: ownedCoursesWhere },
                }),
            ]);

        return {
            totalCourses,
            totalEvents,
            totalRegistrations,
            totalEnrollments,
            totalLeads: totalRegistrations + totalEnrollments,
        };
    }
}
