"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminEventsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const XLSX = __importStar(require("xlsx"));
const pdfkit_1 = __importDefault(require("pdfkit"));
let AdminEventsService = class AdminEventsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    assertAdmin(role) {
        if (role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Não autorizado');
        }
    }
    async updateEvent(eventId, userRole, body) {
        this.assertAdmin(userRole);
        const { title, description, bannerUrl, maxRegistrations, status } = body;
        const updates = {};
        if (title !== undefined)
            updates.title = title;
        if (description !== undefined)
            updates.description = description;
        if (status !== undefined)
            updates.status = status;
        if (maxRegistrations !== undefined)
            updates.maxRegistrations = maxRegistrations;
        if (bannerUrl !== undefined) {
            updates.bannerUrl = bannerUrl ? bannerUrl : null;
        }
        const event = await this.prisma.event.update({
            where: { id: eventId },
            data: updates,
        });
        return event;
    }
    async deleteEvent(eventId, userRole) {
        this.assertAdmin(userRole);
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
        });
        if (!event) {
            throw new common_1.NotFoundException('Evento não encontrado');
        }
        await this.prisma.event.delete({ where: { id: eventId } });
        return { success: true };
    }
    async getHistory(userRole) {
        this.assertAdmin(userRole);
        const events = await this.prisma.event.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                description: true,
                bannerUrl: true,
                status: true,
                maxRegistrations: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        const history = await Promise.all(events.map(async (event) => {
            const totalRegistrations = await this.prisma.registration.count({
                where: { eventId: event.id },
            });
            const municipalities = await this.prisma.municipalityLimit.findMany({
                where: { eventId: event.id },
                select: {
                    id: true,
                    municipality: true,
                    state: true,
                    defaultLimit: true,
                    classes: {
                        select: {
                            id: true,
                            classNumber: true,
                            limit: true,
                            currentCount: true,
                            status: true,
                            createdAt: true,
                            closedAt: true,
                        },
                        orderBy: { classNumber: 'asc' },
                    },
                },
            });
            return {
                ...event,
                totalRegistrations,
                municipalitiesCount: municipalities.length,
                municipalities,
            };
        }));
        return history;
    }
    async getRegionsSummary(eventId, userRole) {
        this.assertAdmin(userRole);
        const municipalityLimits = await this.prisma.municipalityLimit.findMany({
            where: { eventId },
            include: {
                classes: {
                    orderBy: { classNumber: 'asc' },
                },
            },
            orderBy: [
                { state: 'asc' },
                { municipality: 'asc' },
            ],
        });
        const registrations = await this.prisma.registration.findMany({
            where: { eventId },
            select: {
                id: true,
                municipalityId: true,
                municipalityClassId: true,
                participantType: true,
                city: true,
                state: true,
                status: true,
            },
        });
        const overallByState = new Map();
        const overallByType = {};
        registrations.forEach((registration) => {
            if (!overallByState.has(registration.state)) {
                overallByState.set(registration.state, {
                    total: 0,
                    byParticipantType: {},
                });
            }
            const stateInfo = overallByState.get(registration.state);
            stateInfo.total += 1;
            stateInfo.byParticipantType[registration.participantType] =
                (stateInfo.byParticipantType[registration.participantType] ?? 0) + 1;
            overallByType[registration.participantType] =
                (overallByType[registration.participantType] ?? 0) + 1;
        });
        const limitsWithSummary = municipalityLimits.map((limit) => {
            const regsForMunicipality = registrations.filter((registration) => registration.municipalityId === limit.id);
            const byParticipantType = {};
            regsForMunicipality.forEach((registration) => {
                byParticipantType[registration.participantType] =
                    (byParticipantType[registration.participantType] ?? 0) + 1;
            });
            const classes = limit.classes.map((classItem) => {
                const regsForClass = regsForMunicipality.filter((registration) => registration.municipalityClassId === classItem.id);
                return {
                    id: classItem.id,
                    classNumber: classItem.classNumber,
                    limit: classItem.limit,
                    currentCount: classItem.currentCount,
                    status: classItem.status,
                    createdAt: classItem.createdAt,
                    closedAt: classItem.closedAt,
                    registrations: regsForClass.length,
                };
            });
            const activeClass = classes.find((classItem) => classItem.status === client_1.MunicipalityClassStatus.ACTIVE);
            return {
                id: limit.id,
                municipality: limit.municipality,
                state: limit.state,
                defaultLimit: limit.defaultLimit,
                totalRegistrations: regsForMunicipality.length,
                byParticipantType,
                classes,
                activeClassNumber: activeClass?.classNumber ?? null,
                activeClassLimit: activeClass?.limit ?? null,
                activeClassCount: activeClass?.currentCount ?? null,
            };
        });
        return {
            regions: limitsWithSummary,
            overall: {
                totalRegistrations: registrations.length,
                byParticipantType: overallByType,
                byState: Array.from(overallByState.entries()).map(([state, info]) => ({
                    state,
                    total: info.total,
                    byParticipantType: info.byParticipantType,
                })),
            },
        };
    }
    async listEventRegistrations(eventId, userRole) {
        this.assertAdmin(userRole);
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, title: true },
        });
        if (!event) {
            throw new common_1.NotFoundException('Evento não encontrado');
        }
        const registrations = await this.prisma.registration.findMany({
            where: { eventId },
            include: {
                municipality: {
                    select: {
                        municipality: true,
                        state: true,
                    },
                },
                municipalityClass: {
                    select: {
                        classNumber: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        return {
            event,
            registrations,
        };
    }
    async exportRegistrations(eventId, userRole, formatParam, fieldsParam) {
        this.assertAdmin(userRole);
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: {
                title: true,
            },
        });
        if (!event) {
            throw new common_1.NotFoundException('Evento não encontrado');
        }
        const registrations = await this.prisma.registration.findMany({
            where: { eventId },
            include: {
                municipality: {
                    select: {
                        municipality: true,
                        state: true,
                    },
                },
                municipalityClass: {
                    select: {
                        classNumber: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        const participantTypeLabels = {
            PRODUTOR: 'Produtor',
            ESTUDANTE: 'Estudante',
            PROFESSOR: 'Professor',
            PESQUISADOR: 'Pesquisador',
        };
        const statusLabels = {
            PENDING: 'Pendente',
            CONFIRMED: 'Confirmado',
            CANCELLED: 'Cancelado',
        };
        const availableFields = {
            number: {
                label: 'Nº',
                getter: (_r) => 0,
            },
            name: {
                label: 'Nome Completo',
                getter: (r) => r.name,
            },
            cpf: {
                label: 'CPF',
                getter: (r) => r.cpf,
            },
            email: {
                label: 'E-mail',
                getter: (r) => r.email,
            },
            phone: {
                label: 'Telefone',
                getter: (r) => r.phone,
            },
            cep: {
                label: 'CEP',
                getter: (r) => r.cep,
            },
            locality: {
                label: 'Localidade/Bairro',
                getter: (r) => r.locality,
            },
            city: {
                label: 'Cidade',
                getter: (r) => r.city,
            },
            state: {
                label: 'Estado',
                getter: (r) => r.state,
            },
            participantType: {
                label: 'Tipo de Participante',
                getter: (r) => participantTypeLabels[r.participantType] ||
                    r.participantType ||
                    '-',
            },
            otherType: {
                label: 'O que você é?',
                getter: (r) => r.otherType || '-',
            },
            pondCount: {
                label: 'Quantidade de Viveiros',
                getter: (r) => r.pondCount ?? '-',
            },
            waterDepth: {
                label: 'Lâmina d\'água (metros)',
                getter: (r) => r.waterDepth ?? '-',
            },
            municipality: {
                label: 'Município',
                getter: (r) => r.municipality?.municipality || r.city || '-',
            },
            classNumber: {
                label: 'Turma',
                getter: (r) => r.municipalityClass?.classNumber || r.batchNumber || '-',
            },
            status: {
                label: 'Status',
                getter: (r) => statusLabels[r.status] || r.status || '-',
            },
            createdAt: {
                label: 'Data de Cadastro',
                getter: (r) => new Date(r.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                }),
            },
        };
        const defaultFields = [
            'number',
            'name',
            'cpf',
            'email',
            'phone',
            'city',
            'state',
            'participantType',
            'classNumber',
            'createdAt',
        ];
        function parseFields(fields) {
            if (!fields || fields.length === 0) {
                return [...defaultFields];
            }
            const parsed = fields
                .map((field) => field.trim())
                .filter((field) => field in availableFields);
            return parsed.length > 0 ? parsed : [...defaultFields];
        }
        const selectedFields = parseFields(fieldsParam);
        const headerRow = selectedFields.map((key) => availableFields[key].label);
        const dataRows = registrations.map((registration, index) => selectedFields.map((key) => {
            const value = key === 'number'
                ? index + 1
                : availableFields[key].getter(registration);
            return value === null || value === undefined ? '' : String(value);
        }));
        const sanitizedTitle = event.title
            .replace(/[^a-z0-9]/gi, '-')
            .toLowerCase();
        const formatType = formatParam === 'csv' || formatParam === 'pdf' ? formatParam : 'xlsx';
        if (formatType === 'pdf') {
            const doc = new pdfkit_1.default({ size: 'A4', margin: 40 });
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            const pdfPromise = new Promise((resolve) => {
                doc.on('end', () => resolve(Buffer.concat(chunks)));
            });
            doc.fontSize(16).text(`Relatório de Cadastros - ${event.title}`);
            doc.moveDown();
            if (registrations.length === 0) {
                doc.fontSize(12).text('Nenhum cadastro encontrado.');
            }
            else {
                registrations.forEach((registration, index) => {
                    doc.fontSize(12).font('Helvetica-Bold').text(`Participante ${index + 1}`);
                    doc.moveDown(0.2);
                    selectedFields.forEach((fieldKey) => {
                        if (fieldKey === 'number')
                            return;
                        const descriptor = availableFields[fieldKey];
                        const value = descriptor.getter(registration);
                        doc
                            .font('Helvetica')
                            .fontSize(11)
                            .text(`${descriptor.label}: ${value ?? '-'}`);
                    });
                    doc.moveDown();
                });
            }
            doc.end();
            const pdfBuffer = await pdfPromise;
            const arrayBuffer = new Uint8Array(pdfBuffer).buffer;
            return {
                buffer: arrayBuffer,
                contentType: 'application/pdf',
                filename: `cadastros-${sanitizedTitle}.pdf`,
            };
        }
        const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cadastros');
        if (formatType === 'csv') {
            const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
            const csvBuffer = Buffer.from(csv, 'utf-8');
            return {
                buffer: csvBuffer,
                contentType: 'text/csv; charset=utf-8',
                filename: `cadastros-${sanitizedTitle}.csv`,
            };
        }
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return {
            buffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: `cadastros-${sanitizedTitle}.xlsx`,
        };
    }
    async updateMunicipalityLimit(limitId, userRole, body) {
        this.assertAdmin(userRole);
        const limit = await this.prisma.municipalityLimit.findUnique({
            where: { id: limitId },
        });
        if (!limit) {
            throw new common_1.NotFoundException('Limite de município não encontrado');
        }
        return this.prisma.municipalityLimit.update({
            where: { id: limitId },
            data: {
                defaultLimit: body.defaultLimit,
            },
        });
    }
    async closeClass(classId, userRole) {
        this.assertAdmin(userRole);
        const classItem = await this.prisma.municipalityClass.findUnique({
            where: { id: classId },
        });
        if (!classItem) {
            throw new common_1.NotFoundException('Turma não encontrada');
        }
        if (classItem.status === client_1.MunicipalityClassStatus.CLOSED) {
            throw new common_1.ForbiddenException('Turma já está encerrada');
        }
        return this.prisma.municipalityClass.update({
            where: { id: classId },
            data: {
                status: client_1.MunicipalityClassStatus.CLOSED,
                closedAt: new Date(),
            },
        });
    }
};
exports.AdminEventsService = AdminEventsService;
exports.AdminEventsService = AdminEventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminEventsService);
//# sourceMappingURL=admin-events.service.js.map