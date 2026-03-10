import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsObject,
} from 'class-validator';

export class CreateChatCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  message_template: string;

  @IsArray()
  @IsNotEmpty()
  contacts: {
    name: string;
    phone: string;
  }[];

  @IsString()
  @IsNotEmpty()
  channel_id: string;

  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class ChatCampaignHistoryFilterDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
