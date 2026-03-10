import { IsOptional, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}

export class ChatConversationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  channelId?: string;

  @IsOptional()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  unreadOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isArchived?: boolean;

  @IsOptional()
  assignedUserId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  unassigned?: boolean;
}
