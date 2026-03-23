import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['atendimento', 'comercial', 'suporte', 'cobranca', 'operacional', 'analitico'])
  module?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  knowledgeBase?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  tools?: string[];

  @IsOptional()
  @IsArray()
  allowedChannelIds?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['HUMAN', 'COPILOT', 'AUTONOMOUS'])
  defaultMode?: 'HUMAN' | 'COPILOT' | 'AUTONOMOUS';
}
