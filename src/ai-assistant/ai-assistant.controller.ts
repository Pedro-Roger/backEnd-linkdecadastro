import { Controller, Get, Put, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('admin/ai-assistant')
@UseGuards(JwtAuthGuard)
export class AiAssistantController {
    constructor(private readonly aiAssistantService: AiAssistantService) { }

    @Get('config')
    async getConfig(@Request() req: any) {
        return this.aiAssistantService.getConfig(req.user.id);
    }

    @Put('config')
    async updateConfig(@Request() req: any, @Body() body: { isActive?: boolean; prompt?: string; context?: string }) {
        return this.aiAssistantService.updateConfig(req.user.id, body);
    }

    @Post('chat')
    async chat(
        @Request() req: any,
        @Body() body: { message: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> },
    ) {
        return this.aiAssistantService.chat(req.user.id, body);
    }
}
