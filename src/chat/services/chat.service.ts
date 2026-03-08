import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ConnectInstanceResponseDto } from '../dto/connect-channel-response.dto';
import { ChannelStatusDto } from '../dto/channel-status.dto';
import type { IChatRepository } from '../repository/chat.repository';
import type { IChatProviderService } from './evolution-api.service';
import { InstancesServerService } from './instances-server.service';
import { ChatChannel, ChatMessage } from '../entities/chat.entity';
import { ChatConversationsQueryDto, PaginationQueryDto } from '../dto/pagination.dto';

export interface PaginationDataDto<T> {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
    data: T[];
}

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        @Inject('CHAT_REPOSITORY') private readonly repository: IChatRepository,
        @Inject('CHAT_PROVIDER_SERVICE') private readonly provider: IChatProviderService,
        private readonly evolutionInstancesService: InstancesServerService,
    ) { }

    private getProviderByType(type: string): string {
        return type.toLowerCase() === 'whatsapp' ? 'WHATSAPP-EVOLUTION' : 'WHATSAPP-EVOLUTION';
    }

    async connectChannel(type: string, channelId?: string): Promise<ConnectInstanceResponseDto> {
        const companyId = 'DEFAULT_COMPANY';
        const providerType = this.getProviderByType(type);

        let channel: ChatChannel | null;
        let instanceName: string;

        if (channelId) {
            channel = await this.repository.findById(channelId);
            if (!channel) throw new NotFoundException('Channel not found');
            instanceName = channel.instance_name;
        } else {
            channel = await this.repository.findByCompanyId(companyId, providerType);
            if (channel) {
                instanceName = channel.instance_name;
            } else {
                const availableInstance = await this.evolutionInstancesService.getAvailableInstance('EVOLUTION');
                const id = uuidv4();
                instanceName = `${type}_${id}`;
                channel = await this.repository.create({
                    company_id: companyId,
                    provider: providerType,
                    instance_name: instanceName,
                    name: 'Dispositivo',
                    status: 'connecting',
                    instance_server_id: availableInstance?.id,
                });
            }
        }

        const createdData = await this.provider.createInstance(instanceName, channel.instance_server_id);
        const qrCode = createdData?.qrcode?.base64 || createdData?.qrcode;

        if (!qrCode) {
            const status = await this.provider.getStatus(instanceName, channel.instance_server_id);
            if (status === 'connected') {
                await this.repository.update(channel.id, { status: 'connected' });
                return { qrCode: null, expiresAt: null, instanceName };
            }
        }

        await this.provider.setSettings(instanceName, channel.instance_server_id);

        return { qrCode, expiresAt: new Date(Date.now() + 60000), instanceName };
    }

    async getStatus(type: string, channelId?: string): Promise<ChannelStatusDto> {
        const companyId = 'DEFAULT_COMPANY';
        const providerType = this.getProviderByType(type);
        const channel = channelId
            ? await this.repository.findById(channelId)
            : await this.repository.findByCompanyId(companyId, providerType);

        if (!channel) return { status: 'disconnected' } as any;

        if (channel.status === 'connecting' || channel.status === 'connected') {
            const details = await this.provider.getInstanceDetails(channel.instance_name, channel.instance_server_id);
            const s = details?.connectionStatus === 'open' ? 'connected' : 'disconnected';
            if (s !== channel.status) {
                await this.repository.update(channel.id, { status: s });
            }
            return { status: s } as any;
        }
        return { status: channel.status } as any;
    }

    async getChannel(type: string, channelId?: string): Promise<ChatChannel | null> {
        const companyId = 'DEFAULT_COMPANY';
        const providerType = this.getProviderByType(type);
        return channelId
            ? this.repository.findById(channelId)
            : this.repository.findByCompanyId(companyId, providerType);
    }

    async sendMessage(type: string, phoneNumber: string, message: string, channelId?: string): Promise<any> {
        const companyId = 'DEFAULT_COMPANY';
        const providerType = this.getProviderByType(type);

        const channel = channelId ? await this.repository.findById(channelId) : await this.repository.findByCompanyId(companyId, providerType);
        if (!channel) throw new NotFoundException('Channel not found');

        return await this.provider.sendTextMessage(channel.instance_name, phoneNumber, message, channel.instance_server_id);
    }

    async disconnectByChannelId(channelId: string): Promise<{ success: boolean }> {
        const channel = await this.repository.findById(channelId);
        if (!channel) throw new NotFoundException('Channel not found');
        await this.provider.deleteInstance(channel.instance_name, channel.instance_server_id);
        await this.repository.delete(channel.id);
        return { success: true };
    }

    async disconnect(type: string, channelId?: string): Promise<{ success: boolean }> {
        return channelId ? this.disconnectByChannelId(channelId) : { success: false };
    }

    async createChannel(type: string, name?: string): Promise<ChatChannel> {
        const companyId = 'DEFAULT_COMPANY';
        const providerType = this.getProviderByType(type);
        const id = uuidv4();
        const instanceName = `${type}_${id}`;
        const availableInstance = await this.evolutionInstancesService.getAvailableInstance('EVOLUTION');
        return this.repository.create({
            company_id: companyId,
            provider: providerType,
            instance_name: instanceName,
            name: name || 'Dispositivo',
            status: 'disconnected',
            instance_server_id: availableInstance?.id,
        });
    }

    async listChannels(type: string): Promise<ChatChannel[]> {
        return this.repository.findManyByCompanyIdAndProvider('DEFAULT_COMPANY', this.getProviderByType(type));
    }

    async getConversations(type: string, searchParams?: ChatConversationsQueryDto): Promise<PaginationDataDto<any>> {
        const data = await this.repository.listConversations(searchParams?.channelId ? [searchParams.channelId] : [], searchParams);
        return { data: data[0], total: data[1], page: searchParams?.page || 1, limit: searchParams?.limit || 15, totalPage: Math.ceil(data[1] / (searchParams?.limit || 15)) };
    }

    async getMessages(conversationId: string, pagination?: PaginationQueryDto): Promise<PaginationDataDto<ChatMessage>> {
        const data = await this.repository.listMessages(conversationId, pagination);
        return { data: data[0], total: data[1], page: pagination?.page || 1, limit: pagination?.limit || 50, totalPage: Math.ceil(data[1] / (pagination?.limit || 50)) };
    }

    async sendMediaMessage(type: string, phoneNumber: string, mediaUrl: string, mediaType: any, fileName?: string, caption?: string, mimetype?: string, channelId?: string): Promise<any> {
        const channel = channelId ? await this.repository.findById(channelId) : await this.repository.findByCompanyId('DEFAULT_COMPANY', this.getProviderByType(type));
        if (!channel) throw new NotFoundException('Channel not found');
        return await this.provider.sendMediaMessage(channel.instance_name, phoneNumber, mediaUrl, mediaType, fileName, caption, mimetype, channel.instance_server_id);
    }

    async updateStatus(instanceName: string, status: string) {
        const channel = await this.repository.findByInstanceName(instanceName);
        if (!channel) return;
        await this.repository.update(channel.id, { status: status as any });
    }

    async updateQRCode(instanceName: string, qrCode: string) {
        this.logger.log(`Updated QR Code for ${instanceName}`);
    }
}
