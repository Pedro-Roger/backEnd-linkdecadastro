import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetConversationRouteDto {
  @IsString()
  @IsIn(['HUMAN', 'COPILOT', 'AUTONOMOUS'])
  mode: 'HUMAN' | 'COPILOT' | 'AUTONOMOUS';

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  memorySummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  lastIntent?: string;
}
