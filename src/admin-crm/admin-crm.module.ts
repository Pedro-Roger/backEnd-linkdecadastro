import { Module } from '@nestjs/common';
import { AdminCrmController } from './admin-crm.controller';
import { AdminCrmService } from './admin-crm.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AdminCrmController],
    providers: [AdminCrmService],
    exports: [AdminCrmService],
})
export class AdminCrmModule { }
