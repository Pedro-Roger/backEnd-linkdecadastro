import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AdminCrmService } from './admin-crm.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('admin/crm')
export class AdminCrmController {
    constructor(private readonly adminCrmService: AdminCrmService) { }

    @Get('contacts')
    async listContacts(@Req() req: any) {
        return this.adminCrmService.listAllContacts(req.user.id, req.user.role);
    }

    @Get('stats')
    async getStats(@Req() req: any) {
        return this.adminCrmService.getCrmStats(req.user.id, req.user.role);
    }
}
