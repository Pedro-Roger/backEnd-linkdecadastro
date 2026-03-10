import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiAssistantService {
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
                    prompt: "Você é um assistente de atendimento. Responda as dúvidas de forma educada e baseada estritamente no contexto fornecido. Se não souber a resposta, peça desculpas e diga que irá transferir para um humano.",
                    context: "",
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
}
