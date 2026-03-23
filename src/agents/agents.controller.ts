import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { SetConversationRouteDto } from './dto/set-conversation-route.dto';

@Controller('admin/agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('tools')
  listTools() {
    return this.agentsService.getAvailableTools();
  }

  @Get()
  listAgents(@Request() req: any, @Query('module') module?: string) {
    return this.agentsService.listAgents(req.user.id, req.user.role, module);
  }

  @Get('my-access')
  getMyAccess(@Request() req: any) {
    return this.agentsService.getMyAccess(req.user.id, req.user.role);
  }

  @Post()
  createAgent(@Request() req: any, @Body() body: CreateAgentDto) {
    return this.agentsService.createAgent(req.user.id, req.user.role, body);
  }

  @Get('routes/list')
  listRoutes(@Request() req: any, @Query('channelId') channelId?: string) {
    return this.agentsService.listConversationRoutes(
      req.user.id,
      req.user.role,
      channelId,
    );
  }

  @Get('routes/:conversationId')
  getConversationRoute(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
  ) {
    return this.agentsService.getConversationRoute(
      conversationId,
      req.user.id,
      req.user.role,
    );
  }

  @Put('routes/:conversationId')
  setConversationRoute(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: SetConversationRouteDto,
  ) {
    return this.agentsService.setConversationRoute(
      conversationId,
      req.user.id,
      req.user.role,
      body,
    );
  }

  @Get('access/list')
  listAccesses(@Request() req: any) {
    return this.agentsService.listAccesses(req.user.role);
  }

  @Put('access/:userId')
  setUserAccess(
    @Request() req: any,
    @Param('userId') userId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.agentsService.setUserAccess(
      userId,
      Boolean(enabled),
      req.user.id,
      req.user.role,
    );
  }

  @Get(':agentId')
  getAgent(@Request() req: any, @Param('agentId') agentId: string) {
    return this.agentsService.getAgentById(agentId, req.user.id, req.user.role);
  }

  @Patch(':agentId')
  updateAgent(
    @Request() req: any,
    @Param('agentId') agentId: string,
    @Body() body: UpdateAgentDto,
  ) {
    return this.agentsService.updateAgent(
      agentId,
      req.user.id,
      req.user.role,
      body,
    );
  }

  @Delete(':agentId')
  deleteAgent(@Request() req: any, @Param('agentId') agentId: string) {
    return this.agentsService.deleteAgent(agentId, req.user.role);
  }
}
