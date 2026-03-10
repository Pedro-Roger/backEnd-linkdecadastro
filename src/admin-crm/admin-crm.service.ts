import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminCrmService {
    constructor(private readonly prisma: PrismaService) { }

    private assertAdmin(role?: string) {
        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Não autorizado');
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

    async listAllContacts(userId: string, userRole?: string) {
        this.assertAdmin(userRole);

        const ownedEventsWhere = this.getOwnedWhereClause(userId, userRole);
        const ownedCoursesWhere = this.getOwnedWhereClause(userId, userRole);

        // Buscar usuários com matrículas em cursos do admin
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

        // Buscar registros (guests) em eventos do admin que não necessariamente têm um User vinculado
        const registrations = await this.prisma.registration.findMany({
            where: {
                event: ownedEventsWhere,
                userId: null, // Apenas guests
            },
            include: {
                event: {
                    select: { title: true },
                },
            },
        });

        // Unificar e formatar para o CRM
        const contactsMap = new Map<string, any>();

        // Adicionar usuários registrados
        usersWithEnrollments.forEach((u) => {
            const key = u.email || u.phone || u.id;
            contactsMap.set(key, {
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone,
                city: u.city,
                state: u.state,
                type: 'USER',
                participantType: u.participantType,
                lastInteraction: u.updatedAt,
                source: [
                    ...u.enrollments.map((e) => `Curso: ${e.course.title}`),
                    ...u.registrations.map((r) => `Evento: ${r.event.title}`),
                ],
            });
        });

        // Adicionar guests de eventos
        registrations.forEach((r) => {
            const key = r.email || r.phone || r.id;
            if (contactsMap.has(key)) {
                contactsMap.get(key).source.push(`Evento: ${r.event.title}`);
            } else {
                contactsMap.set(key, {
                    id: r.id,
                    name: r.name,
                    email: r.email,
                    phone: r.phone,
                    city: r.city,
                    state: r.state,
                    type: 'GUEST',
                    participantType: r.participantType,
                    lastInteraction: r.updatedAt,
                    source: [`Evento: ${r.event.title}`],
                });
            }
        });

        return Array.from(contactsMap.values()).sort(
            (a, b) =>
                new Date(b.lastInteraction).getTime() -
                new Date(a.lastInteraction).getTime(),
        );
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
            totalLeads: totalRegistrations + totalEnrollments, // Simplificado
        };
    }
}
