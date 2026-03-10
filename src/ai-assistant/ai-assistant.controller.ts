import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
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
}
