import {
    BadGatewayException,
    Injectable,
    InternalServerErrorException,
    UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiAssistantService {
    private static readonly INVOKE_URL =
        'https://openrouter.ai/api/v1/chat/completions';

    constructor(private readonly prisma: PrismaService) { }

    private slugify(value: string) {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .slice(0, 120);
    }

    private makeUniqueSlug(base: string) {
        const root = this.slugify(base) || `item-${Date.now()}`;
        return `${root}-${Math.random().toString(36).slice(2, 7)}`;
    }

    private extractLimit(message: string) {
        const match = message.match(/limite\s*(?:de|para)?\s*(\d{1,6})/i);
        return match ? Number(match[1]) : null;
    }

    private extractQuotedName(message: string) {
        const quoted = message.match(/["“](.+?)["”]/);
        if (quoted?.[1]) return quoted[1].trim();

        const withName = message.match(/nome\s+(.+?)(?:\s+com\s+limite|\s*$)/i);
        if (withName?.[1]) return withName[1].trim();

        const createThing = message.match(/crie\s+(?:um|uma)\s+(?:evento|curso)\s+(.+?)(?:\s+com\s+limite|\s*$)/i);
        return createThing?.[1]?.trim() || null;
    }

    private extractDescription(message: string) {
        const match = message.match(/descri(?:cao|ção)\s+(.+?)(?:\s+status\s+|\s+slug\s+|\s+com\s+limite|\s*$)/i);
        return match?.[1]?.trim() || null;
    }

    private extractSlug(message: string) {
        const match = message.match(/slug\s+([a-z0-9-_]+)/i);
        return match?.[1]?.trim() || null;
    }

    private extractStatus(message: string) {
        const match = message.match(/status\s+(ativo|active|inativo|inactive|closed|fechado)/i);
        const value = match?.[1]?.toLowerCase();
        if (!value) return null;
        if (value === 'inativo' || value === 'inactive') return 'INACTIVE';
        if (value === 'closed' || value === 'fechado') return 'CLOSED';
        return 'ACTIVE';
    }

    private extractDates(message: string) {
        const startMatch = message.match(/(?:inicio|in[ií]cio|come[cç]a|comeca)\s+(\d{4}-\d{2}-\d{2})/i);
        const endMatch = message.match(/(?:fim|termina|encerra)\s+(\d{4}-\d{2}-\d{2})/i);
        return {
            startDate: startMatch?.[1] || null,
            endDate: endMatch?.[1] || null,
        };
    }

    private wantsNoPhoto(message: string) {
        return /(sem foto|sem imagem|sem banner|nao precisa foto|não precisa foto|pode criar sem foto|segue sem foto)/i.test(message);
    }

    private parseAction(message: string) {
        const normalized = message.trim();
        const lower = normalized.toLowerCase();
        const dates = this.extractDates(normalized);

        if (lower.includes('crie um evento') || lower.includes('criar um evento')) {
            return {
                type: 'create_event' as const,
                name: this.extractQuotedName(normalized),
                limit: this.extractLimit(normalized),
                description: this.extractDescription(normalized),
                slug: this.extractSlug(normalized),
                status: this.extractStatus(normalized),
                ...dates,
            };
        }

        if (lower.includes('crie um curso') || lower.includes('criar um curso')) {
            return {
                type: 'create_course' as const,
                name: this.extractQuotedName(normalized),
                limit: this.extractLimit(normalized),
                description: this.extractDescription(normalized),
                slug: this.extractSlug(normalized),
                status: this.extractStatus(normalized),
                ...dates,
            };
        }

        return null;
    }

    async getConfig(userId: string) {
        let config = await this.prisma.aiAssistantConfig.findUnique({
            where: { userId },
        });

        if (!config) {
            config = await this.prisma.aiAssistantConfig.create({
                data: {
                    userId,
                    isActive: false,
                    prompt: 'Voce e um assistente administrativo. Responda com clareza, execute acoes permitidas e, quando nao puder agir, explique o proximo passo.',
                    context: '',
                    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
                    apiKey: null,
                    apiKeyLabel: null,
                    allowEventCreation: true,
                    allowCourseCreation: true,
                    defaultMaxRegistrations: 1000,
                },
            });
        }

        return {
            ...config,
            hasCustomApiKey: Boolean(config.apiKey),
        };
    }

    async updateConfig(
        userId: string,
        data: {
            isActive?: boolean;
            prompt?: string;
            context?: string;
            model?: string;
            apiKey?: string;
            apiKeyLabel?: string;
            allowEventCreation?: boolean;
            allowCourseCreation?: boolean;
            defaultMaxRegistrations?: number;
        },
    ) {
        const payload = {
            isActive: data.isActive,
            prompt: data.prompt,
            context: data.context,
            model: data.model,
            apiKey: data.apiKey !== undefined ? data.apiKey?.trim() || null : undefined,
            apiKeyLabel:
                data.apiKeyLabel !== undefined ? data.apiKeyLabel?.trim() || null : undefined,
            allowEventCreation: data.allowEventCreation,
            allowCourseCreation: data.allowCourseCreation,
            defaultMaxRegistrations:
                data.defaultMaxRegistrations !== undefined
                    ? Number(data.defaultMaxRegistrations) || 1000
                    : undefined,
        };

        const updated = await this.prisma.aiAssistantConfig.upsert({
            where: { userId },
            update: payload,
            create: {
                userId,
                isActive: payload.isActive ?? false,
                prompt: payload.prompt ?? '',
                context: payload.context ?? '',
                model: payload.model ?? (process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini'),
                apiKey: payload.apiKey ?? null,
                apiKeyLabel: payload.apiKeyLabel ?? null,
                allowEventCreation: payload.allowEventCreation ?? true,
                allowCourseCreation: payload.allowCourseCreation ?? true,
                defaultMaxRegistrations: payload.defaultMaxRegistrations ?? 1000,
            },
        });

        return {
            ...updated,
            hasCustomApiKey: Boolean(updated.apiKey),
        };
    }

    private buildActionCard(params: {
        title: string;
        subtitle: string;
        fields: Array<{ label: string; value: string }>;
        link?: string;
        status: 'pending' | 'completed';
    }) {
        return params;
    }

    private async handleCreateEvent(
        userId: string,
        action: {
            name: string | null;
            limit: number | null;
            description?: string | null;
            slug?: string | null;
            status?: string | null;
            startDate?: string | null;
            endDate?: string | null;
        },
        config: any,
        mediaUrl?: string | null,
    ) {
        const title = action.name?.trim();
        if (!title) {
            return {
                message: 'Eu preciso do nome do evento para criar. Exemplo: crie um evento com nome "Workshop de Vendas".',
            };
        }

        const slug = action.slug || this.makeUniqueSlug(title);
        const maxRegistrations = action.limit || config.defaultMaxRegistrations || 1000;
        const linkId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        const event = await this.prisma.event.create({
            data: {
                title,
                description:
                    action.description ||
                    `Evento criado pelo AI Assist em ${new Date().toLocaleString('pt-BR')}.`,
                slug: this.slugify(slug),
                linkId,
                maxRegistrations,
                bannerUrl: mediaUrl || null,
                status: (action.status || 'ACTIVE') as any,
                createdBy: userId,
            },
        });

        const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/e/${event.slug || event.linkId}`;

        return {
            message: `Evento criado com sucesso.\n\nNome: ${event.title}\nLimite: ${event.maxRegistrations || 1000} pessoas\nLink do formulario: ${link}`,
            actionCard: this.buildActionCard({
                title: 'Evento criado',
                subtitle: event.title,
                status: 'completed',
                link,
                fields: [
                    { label: 'Status', value: event.status },
                    { label: 'Limite', value: String(event.maxRegistrations || 1000) },
                    { label: 'Slug', value: event.slug || event.linkId },
                    { label: 'Banner', value: mediaUrl ? 'Com imagem' : 'Sem imagem' },
                ],
            }),
            action: {
                type: 'create_event',
                eventId: event.id,
                link,
            },
        };
    }

    private async handleCreateCourse(
        userId: string,
        action: {
            name: string | null;
            limit: number | null;
            description?: string | null;
            slug?: string | null;
            status?: string | null;
            startDate?: string | null;
            endDate?: string | null;
        },
        config: any,
        mediaUrl?: string | null,
    ) {
        const title = action.name?.trim();
        if (!title) {
            return {
                message: 'Eu preciso do nome do curso para criar. Exemplo: crie um curso com nome "Formacao Comercial".',
            };
        }

        const slug = action.slug || this.makeUniqueSlug(title);
        const maxEnrollments = action.limit || config.defaultMaxRegistrations || 1000;

        const course = await this.prisma.course.create({
            data: {
                title,
                description:
                    action.description ||
                    `Curso criado pelo AI Assist em ${new Date().toLocaleString('pt-BR')}.`,
                bannerUrl: mediaUrl || null,
                slug: this.slugify(slug),
                status: action.status || 'ACTIVE',
                type: 'ONLINE',
                maxEnrollments,
                startDate: action.startDate ? new Date(action.startDate) : null,
                endDate: action.endDate ? new Date(action.endDate) : null,
                createdBy: userId,
            },
        });

        const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/c/${course.slug || course.id}`;

        return {
            message: `Curso criado com sucesso.\n\nNome: ${course.title}\nLimite: ${course.maxEnrollments || 1000} pessoas\nLink de acesso: ${link}`,
            actionCard: this.buildActionCard({
                title: 'Curso criado',
                subtitle: course.title,
                status: 'completed',
                link,
                fields: [
                    { label: 'Status', value: course.status },
                    { label: 'Limite', value: String(course.maxEnrollments || 1000) },
                    { label: 'Slug', value: course.slug || course.id },
                    { label: 'Banner', value: mediaUrl ? 'Com imagem' : 'Sem imagem' },
                ],
            }),
            action: {
                type: 'create_course',
                courseId: course.id,
                link,
            },
        };
    }

    async chat(
        userId: string,
        body: {
            message: string;
            mediaUrl?: string | null;
            history?: Array<{ role: 'user' | 'assistant'; content: string }>;
            pendingAction?: any;
        },
    ) {
        const message = body.message?.trim();
        if (!message) {
            throw new InternalServerErrorException('Mensagem nao informada.');
        }

        const [user, config, courses, events] = await Promise.all([
            this.prisma.user.findUnique({ where: { id: userId } }),
            this.getConfig(userId),
            this.prisma.course.findMany({
                where: { createdBy: userId },
                include: {
                    _count: { select: { enrollments: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 15,
            }).catch(() => []),
            this.prisma.event.findMany({
                where: { createdBy: userId },
                include: {
                    _count: { select: { registrations: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }).catch(() => []),
        ]);

        const pendingAction = body.pendingAction || null;
        if (pendingAction?.type === 'create_event') {
            if (body.mediaUrl || this.wantsNoPhoto(message)) {
                return this.handleCreateEvent(
                    userId,
                    pendingAction.payload,
                    config,
                    body.mediaUrl || null,
                );
            }

            return {
                message: 'Se quiser, me envie agora a foto/banner do evento. Se preferir continuar sem imagem, responda "sem foto".',
                pendingAction,
                actionCard: this.buildActionCard({
                    title: 'Criacao de evento pendente',
                    subtitle: pendingAction.payload?.name || 'Novo evento',
                    status: 'pending',
                    fields: [
                        { label: 'Limite', value: String(pendingAction.payload?.limit || config.defaultMaxRegistrations || 1000) },
                        { label: 'Slug', value: pendingAction.payload?.slug || 'Automatico' },
                    ],
                }),
            };
        }

        if (pendingAction?.type === 'create_course') {
            if (body.mediaUrl || this.wantsNoPhoto(message)) {
                return this.handleCreateCourse(
                    userId,
                    pendingAction.payload,
                    config,
                    body.mediaUrl || null,
                );
            }

            return {
                message: 'Se quiser, me envie agora a foto/banner do curso. Se preferir continuar sem imagem, responda "sem foto".',
                pendingAction,
                actionCard: this.buildActionCard({
                    title: 'Criacao de curso pendente',
                    subtitle: pendingAction.payload?.name || 'Novo curso',
                    status: 'pending',
                    fields: [
                        { label: 'Limite', value: String(pendingAction.payload?.limit || config.defaultMaxRegistrations || 1000) },
                        { label: 'Slug', value: pendingAction.payload?.slug || 'Automatico' },
                    ],
                }),
            };
        }

        const action = this.parseAction(message);
        if (action?.type === 'create_event' && config.allowEventCreation) {
            return {
                message: 'Posso criar esse evento agora. Se quiser, me envie a foto/banner dele. Se preferir seguir sem imagem, responda "sem foto".',
                pendingAction: {
                    type: 'create_event',
                    payload: {
                        ...action,
                        limit: action.limit || config.defaultMaxRegistrations || 1000,
                    },
                },
                actionCard: this.buildActionCard({
                    title: 'Novo evento em preparacao',
                    subtitle: action.name || 'Evento',
                    status: 'pending',
                    fields: [
                        { label: 'Limite', value: String(action.limit || config.defaultMaxRegistrations || 1000) },
                        { label: 'Slug', value: action.slug || 'Automatico' },
                        { label: 'Status', value: action.status || 'ACTIVE' },
                    ],
                }),
            };
        }

        if (action?.type === 'create_course' && config.allowCourseCreation) {
            return {
                message: 'Posso criar esse curso agora. Se quiser, me envie a foto/banner dele. Se preferir seguir sem imagem, responda "sem foto".',
                pendingAction: {
                    type: 'create_course',
                    payload: {
                        ...action,
                        limit: action.limit || config.defaultMaxRegistrations || 1000,
                    },
                },
                actionCard: this.buildActionCard({
                    title: 'Novo curso em preparacao',
                    subtitle: action.name || 'Curso',
                    status: 'pending',
                    fields: [
                        { label: 'Limite', value: String(action.limit || config.defaultMaxRegistrations || 1000) },
                        { label: 'Slug', value: action.slug || 'Automatico' },
                        { label: 'Status', value: action.status || 'ACTIVE' },
                    ],
                }),
            };
        }

        const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new InternalServerErrorException(
                'Nenhuma API key foi configurada para a AI Assist no backend.',
            );
        }

        const coursesStr = courses.length
            ? courses
                .map((course) =>
                    `- Curso: ${course.title} | Status: ${course.status} | Inscritos: ${course._count?.enrollments || 0}`,
                )
                .join('\n')
            : '- Nenhum curso encontrado';

        const eventsStr = events.length
            ? events
                .map((event) =>
                    `- Evento: ${event.title} | Status: ${event.status} | Inscritos: ${event._count?.registrations || 0}`,
                )
                .join('\n')
            : '- Nenhum evento encontrado';

        const systemPrompt = `
Voce e o copiloto administrativo da Link de Cadastro.
Responda sempre em portugues do Brasil, com linguagem natural, inteligente e util.

OBJETIVO:
- ajudar o administrador com duvidas sobre cursos, eventos, atendimento e operacao;
- executar acoes operacionais quando estiverem explicitamente permitidas;
- responder como um parceiro experiente, nao como um robo engessado;
- usar o contexto abaixo antes de responder;
- quando faltar dado real, admita com clareza e sugira o proximo passo.

CAPACIDADES CONFIGURADAS:
- Pode criar eventos: ${config.allowEventCreation ? 'Sim' : 'Nao'}
- Pode criar cursos: ${config.allowCourseCreation ? 'Sim' : 'Nao'}
- Limite padrao para criacoes: ${config.defaultMaxRegistrations || 1000}

ESTILO:
- seja direto, mas humano;
- priorize respostas acionaveis;
- se a pergunta for ampla, organize a resposta em passos curtos;
- evite inventar numeros, cadastros ou resultados.

PERSONALIZACAO:
${config.prompt || 'Atue com clareza, contexto e boa capacidade analitica.'}

BASE DE CONHECIMENTO:
${config.context || 'Sem contexto adicional informado.'}

ADMINISTRADOR:
- Nome: ${user?.name || 'Administrador'}
- Email: ${user?.email || 'Nao informado'}
- Perfil: ${user?.role || 'ADMIN'}

CURSOS:
${coursesStr}

EVENTOS:
${eventsStr}
        `.trim();

        const history = (body.history || [])
            .filter((item) => item?.content?.trim())
            .slice(-12)
            .map((item) => ({
                role: item.role,
                content: item.content,
            }));

        const response = await fetch(AiAssistantService.INVOKE_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                model: config.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
                temperature: 0.4,
                max_tokens: 700,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history,
                    { role: 'user', content: message },
                ],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            const details = errorText?.slice(0, 500) || `${response.status} ${response.statusText}`;

            if (response.status === 401 || response.status === 403) {
                throw new UnauthorizedException(
                    `Falha ao autenticar na OpenRouter. Verifique a API key configurada no backend. Detalhes: ${details}`,
                );
            }

            throw new BadGatewayException(
                `OpenRouter respondeu com erro ${response.status}. Detalhes: ${details}`,
            );
        }

        const data = (await response.json()) as any;
        return {
            message: data?.choices?.[0]?.message?.content?.trim() || '',
        };
    }
}
