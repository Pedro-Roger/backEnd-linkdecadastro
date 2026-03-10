import { Module } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantController } from './ai-assistant.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AiAssistantController],
    providers: [AiAssistantService],
    exports: [AiAssistantService],
})
export class AiAssistantModule { }
