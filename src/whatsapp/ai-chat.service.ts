import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AiChatService {
    private static INVOKE_URL = "https://openrouter.ai/api/v1/chat/completions";

    constructor(private prisma: PrismaService) { }

    public async consultarAssistente(perguntaUsuario: string, telefoneDoUsuario: string) {
        const API_KEY = process.env.OPENROUTER_API_KEY;

        if (!API_KEY) {
            console.warn("OPENROUTER_API_KEY não está configurada no .env.");
            return "Desculpe, estou enfrentando problemas de configuração no momento.";
        }

        try {
            // 1. Busca os dados do usuário no banco usando Prisma
            // Aqui procuramos pelo telefone no Registration ou User dependendo da sua regra de negócio
            // Vamos assumir que estamos buscando no User (ou você pode adaptar conforme a entidade correta)
            const user = await this.prisma.user.findFirst({
                where: { phone: telefoneDoUsuario },
            });

            const registrations = await this.prisma.registration.findMany({
                where: { phone: telefoneDoUsuario },
                include: { event: true }
            });

            const courses = await this.prisma.course.findMany({
                where: { createdBy: user?.id }
            });

            const events = await this.prisma.event.findMany({
                where: { createdBy: user?.id }
            });

            // 2. Busca Eventos ATIVOS para oferecer ao cliente
            const eventosAtivos = await this.prisma.event.findMany({
                where: { status: 'ACTIVE' },
                select: { title: true, slug: true, linkId: true }
            });

            const listaEventos = eventosAtivos.map(e => {
                const link = e.slug ? `https://linkdecadastro.com.br/e/${e.slug}` : `https://linkdecadastro.com.br/register/${e.linkId}`;
                return `- ${e.title}: ${link}`;
            }).join('\n');

            // 3. Prepara os dados de "Resumo"
            const resumoParaIA = {
                nome: user?.name || registrations[0]?.name || "Visitante",
                telefone: telefoneDoUsuario,
                podeVerDados: !!(user || registrations.length > 0),
                totalInscricoes: registrations.length,
                listaEventosDisponiveis: listaEventos || "Nenhum evento disponível no momento."
            };

            // 4. Montamos um "System Prompt" (As regras da IA). 
            const contexto = `
        Você é a inteligência artificial assistente da plataforma Link de Cadastro.
        Sua função é tirar dúvidas de CLIENTES de forma rápida, curta e simpática. Sempre responda em português.
        
        [DADOS DO CLIENTE ATUAL]:
        - Nome: ${resumoParaIA.nome}
        - WhatsApp: ${resumoParaIA.telefone}
        - Já é cadastrado? ${resumoParaIA.podeVerDados ? 'Sim' : 'Não'}
        - Inscrições que ele já possui: ${resumoParaIA.totalInscricoes}
        
        [EVENTOS DISPONÍVEIS PARA INSCRIÇÃO]:
        ${resumoParaIA.listaEventosDisponiveis}
        
        REGRAS DE OURO:
        1. Se o usuário perguntar quais eventos estão disponíveis ou quiser se cadastrar, envie a lista de nomes e LINKS acima.
        2. Seja cordial e use o nome do cliente se souber.
        3. Não invente eventos. Se não estiver na lista acima, diga que não há novos eventos no momento.
        4. Nunca diga que não tem acesso aos dados dele, pois eu acabei de te passar o que você precisa.
      `;

            const payload = {
                model: "meta-llama/llama-3.1-70b-instruct",
                max_tokens: 500,
                temperature: 0.3,
                messages: [
                    { role: "system", content: contexto },
                    { role: "user", content: perguntaUsuario }
                ]
            };

            const response = await fetch(AiChatService.INVOKE_URL, {
                method: "POST",
                body: JSON.stringify(payload),
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`Erro na API OpenRouter: ${response.statusText}`);
            }

            const responseBody = await response.json() as any;

            return responseBody.choices[0].message.content;

        } catch (error) {
            console.error("Erro na comunicação com OpenRouter AI:", error);
            return "Desculpe, estou enfrentando problemas técnicos para responder no momento.";
        }
    }
}
