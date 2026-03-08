import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatChannelController } from './controller/chat.controller';
import { ChatConversationController } from './controller/chat-conversation.controller';
import { ChatQuickResponseController } from './controller/chat-quick-response.controller';
import { ChatService } from './services/chat.service';
import { EvolutionApiService } from './services/evolution-api.service';
import { InstancesServerService } from './services/instances-server.service';
import { ChatRepository } from './repository/chat.repository';
import { InstancesServerRepository } from './repository/instances-server.repository';
import { Repositories, Services } from './chat.constants';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    HttpModule,
    PrismaModule,
    ConfigModule,
    forwardRef(() => UserModule),
  ],
  controllers: [
    ChatChannelController,
    ChatConversationController,
    ChatQuickResponseController,
  ],
  providers: [
    {
      provide: Services.CHAT_SERVICE,
      useClass: ChatService,
    },
    {
      provide: 'CHAT_PROVIDER_SERVICE', // Used the string here to match ChatService constructor @Inject('CHAT_PROVIDER_SERVICE')
      useClass: EvolutionApiService,
    },
    {
      provide: 'CHAT_REPOSITORY', // Used the string here to match ChatService constructor @Inject('CHAT_REPOSITORY')
      useClass: ChatRepository,
    },
    InstancesServerService,
    InstancesServerRepository,
  ],
  exports: [Services.CHAT_SERVICE, InstancesServerService, InstancesServerRepository],
})
export class ChatModule { }
