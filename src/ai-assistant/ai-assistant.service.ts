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

    async getConfig(userId: string) {
        let config = await this.prisma.aiAssistantConfig.findUnique({
            where: { userId },
        });

        if (!config) {
            config = await this.prisma.aiAssistantConfig.create({
                data: {
                    userId,
                    isActive: false,
                    prompt: 'Voce e um assistente de atendimento. Responda as duvidas de forma educada e baseada estritamente no contexto fornecido. Se nao souber a resposta, peca desculpas e diga que ira transferir para um humano.',
                    context: '',
                },
            });
        }

        return config;
    }

    async updateConfig(userId: string, data: { isActive?: boolean; prompt?: string; context?: string }) {
        return this.prisma.aiAssistantConfig.upsert({
            where: { userId },
            update: data,
            create: {
                userId,
                ...data,
            },
        });
    }

    async chat(
        userId: string,
        body: {
            message: string;
            history?: Array<{ role: 'user' | 'assistant'; content: string }>;
        },
    ) {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new InternalServerErrorException(
                'OPENROUTER_API_KEY nao configurada no backend.',
            );
        }

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
- responder como um parceiro experiente, nao como um robo engessado;
- usar o contexto abaixo antes de responder;
- quando faltar dado real, admita com clareza e sugira o proximo passo.

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
                model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
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
