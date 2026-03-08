import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatChannelController } from './controller/chat.controller';
import { ChatConversationController } from './controller/chat-conversation.controller';
import { ChatQuickResponseController } from './controller/chat-quick-response.controller';
import { ChatCampaignController } from './controller/chat-campaign.controller';
import { ChatService } from './services/chat.service';
import { ChatCampaignService } from './services/chat-campaign.service';
import { EvolutionApiService } from './services/evolution-api.service';
import { InstancesServerService } from './services/instances-server.service';
import { ChatRepository } from './repository/chat.repository';
import { InstancesServerRepository } from './repository/instances-server.repository';
import { Repositories } from '../shared/enum/repositories.enum';
import { Services } from '../shared/enum/services.enum';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from '../users/user.module';
import { QueueModule } from '../queue/queue.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMessageMongo, ChatMessageSchema } from './schemas/chat-message.schema';
import { ChatCampaignMongo, ChatCampaignSchema } from './schemas/chat-campaign.schema';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    HttpModule,
    PrismaModule,
    ConfigModule,
    forwardRef(() => UserModule),
    QueueModule,
    FilesModule,
    MongooseModule.forFeature([
      { name: ChatMessageMongo.name, schema: ChatMessageSchema },
      { name: ChatCampaignMongo.name, schema: ChatCampaignSchema }
    ]),
  ],
  controllers: [
    ChatChannelController,
    ChatConversationController,
    ChatQuickResponseController,
    ChatCampaignController,
  ],
  providers: [
    {
      provide: Services.CHAT_SERVICE,
      useClass: ChatService,
    },
    {
      provide: Repositories.CHAT_PROVIDER_SERVICE,
      useClass: EvolutionApiService,
    },
    {
      provide: Repositories.CHAT_REPOSITORY,
      useClass: ChatRepository,
    },
    {
      provide: Services.CHAT_CAMPAIGN_SERVICE,
      useClass: ChatCampaignService,
    },
    InstancesServerService,
    InstancesServerRepository,
  ],
  exports: [Services.CHAT_SERVICE, InstancesServerService, InstancesServerRepository],
})
export class ChatModule { }
