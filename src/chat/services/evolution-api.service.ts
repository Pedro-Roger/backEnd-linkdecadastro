import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InstancesServerService } from './instances-server.service';

export interface EvolutionInstanceStatus {
  instance: {
    state: 'open' | 'connecting' | 'close';
  };
}

export interface IChatProviderService {
  createInstance(instanceName: string, instanceServerId?: string): Promise<any>;
  setSettings(instanceName: string, instanceServerId?: string): Promise<void>;
  getQRCode(instanceName: string, instanceServerId?: string): Promise<string>;
  getStatus(
    instanceName: string,
    instanceServerId?: string,
  ): Promise<'connected' | 'disconnected' | 'connecting'>;
  getInstanceDetails(
    instanceName: string,
    instanceServerId?: string,
  ): Promise<any>;
  getPhoneNumber(
    instanceName: string,
    instanceServerId?: string,
  ): Promise<string | null>;
  deleteInstance(
    instanceName: string,
    instanceServerId?: string,
  ): Promise<void>;
  sendTextMessage(
    instanceName: string,
    phoneNumber: string,
    text: string,
    instanceServerId?: string,
  ): Promise<any>;
  getProfilePicture(
    instanceName: string,
    phoneNumber: string,
    instanceServerId?: string,
  ): Promise<string | null>;
  sendMediaMessage(
    instanceName: string,
    phoneNumber: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    fileName?: string,
    caption?: string,
    mimetype?: string,
    instanceServerId?: string,
  ): Promise<any>;
  getGroupSubject(
    instanceName: string,
    groupJid: string,
    instanceServerId?: string,
  ): Promise<string | null>;
}

@Injectable()
export class EvolutionApiService implements IChatProviderService {
  private readonly logger = new Logger(EvolutionApiService.name);
  private readonly webhookUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly instancesServerService: InstancesServerService,
  ) {
    const appUrl =
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('API_BASE_URL') ||
      'http://localhost:9002';

    this.webhookUrl = `${appUrl}/webhooks/chat/whatsapp`;
  }

  private async getServerConfig(instanceServerId?: string) {
    let apiUrl = 'http://20.206.240.156:3000';
    let apiToken = '0000000000000000';

    try {
      if (instanceServerId) {
        const instance =
          await this.instancesServerService.getInstanceById(instanceServerId);
        if (instance) {
          apiUrl = instance.url;
          apiToken = instance.api_key;
        }
      } else {
        const defaultInstance =
          await this.instancesServerService.getAvailableInstance('EVOLUTION');
        if (defaultInstance) {
          apiUrl = defaultInstance.url;
          apiToken = defaultInstance.api_key;
        }
      }
    } catch (e) {
      this.logger.warn(
        `Could not fetch instance server config, using defaults. Error: ${e.message}`,
      );
    }

    return {
      apiUrl,
      headers: {
        'Content-Type': 'application/json',
        apikey: apiToken,
      },
    };
  }

  async createInstance(
    instanceName: string,
    instanceServerId?: string,
  ): Promise<any> {
    const config = await this.getServerConfig(instanceServerId);
    try {
      const payload: any = {
        instanceName: instanceName,
        token: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      };

      if (!this.webhookUrl.includes('localhost')) {
        payload.webhook = {
          url: this.webhookUrl,
          byEvents: true,
          base64: true,
          events: [
            'QRCODE_UPDATED',
            'MESSAGES_SET',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'MESSAGES_DELETE',
            'SEND_MESSAGE',
            'CONNECTION_UPDATE',
            'TYPEBOT_START',
            'TYPEBOT_CHANGE_STATUS',
          ],
        };
      } else {
        this.logger.warn(
          `Webhook URL is localhost (${this.webhookUrl}), skipping webhook registration.`,
        );
      }

      const response = await firstValueFrom(
        this.httpService.post(`${config.apiUrl}/instance/create`, payload, {
          headers: config.headers,
        }),
      );

      return response.data;
    } catch (error) {
      if (
        error.response?.status === 403 ||
        error.response?.data?.error?.includes('already exists')
      ) {
        this.logger.warn(`Instance ${instanceName} already exists.`);
        return null;
      }
      this.logger.error(
        `Error creating instance: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async setSettings(
    instanceName: string,
    instanceServerId?: string,
  ): Promise<void> {
    const config = await this.getServerConfig(instanceServerId);
    try {
      const payload = {
        rejectCall: false,
        msgCall: '',
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        syncFullHistory: false,
        readStatus: false,
      };

      await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/settings/set/${instanceName}`,
          payload,
          {
            headers: config.headers,
          },
        ),
      );
    } catch (error) {
      this.logger.error(
        `Error setting settings: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getQRCode(
    instanceName: string,
    instanceServerId?: string,
  ): Promise<string> {
    const config = await this.getServerConfig(instanceServerId);
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/instance/connect/${instanceName}`,
          { headers: config.headers },
        ),
      );

      if (response.data?.base64) {
        return response.data.base64;
      }

      if (response.data?.qrcode?.base64) {
        return response.data.qrcode.base64;
      }

      return '';
    } catch (error) {
      this.logger.error(`Error getting QR code: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getStatus(
    instanceName: string,
    instanceServerId?: string,
  ): Promise<'connected' | 'disconnected' | 'connecting'> {
    const config = await this.getServerConfig(instanceServerId);
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/instance/connectionState/${instanceName}`,
          { headers: config.headers },
        ),
      );

      const state = response.data?.instance?.state;

      if (state === 'open') return 'connected';
      if (state === 'connecting') return 'connecting';
      return 'disconnected';
    } catch (error) {
      if (error.response?.status === 404) return 'disconnected';
      this.logger.error(`Error getting status: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getInstanceDetails(
    instanceName: string,
    instanceServerId?: string,
  ): Promise<any> {
    const config = await this.getServerConfig(instanceServerId);
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/instance/fetchInstances?instanceName=${instanceName}`,
          { headers: config.headers },
        ),
      );

      const instances = Array.isArray(response.data)
        ? response.data
        : [response.data];
      return instances.find(
        (i) => i.instanceName === instanceName || i.name === instanceName,
      );
    } catch (error) {
      this.logger.error(`Error fetching instance details: ${error.message}`);
      return null;
    }
  }

  async getPhoneNumber(
    instanceName: string,
    instanceServerId?: string,
  ): Promise<string | null> {
    const config = await this.getServerConfig(instanceServerId);
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/instance/fetchInstances?instanceName=${instanceName}`,
          { headers: config.headers },
        ),
      );

      const instances = Array.isArray(response.data)
        ? response.data
        : [response.data];
      const instance = instances.find(
        (i) => i.instanceName === instanceName || i.name === instanceName,
      );

      if (!instance) return null;

      const owner =
        instance.ownerJid ||
        instance.owner ||
        instance.connectionStatus?.owner ||
        instance.profile?.number ||
        instance.phone;

      if (owner && typeof owner === 'string') {
        return owner.split('@')[0];
      }

      return null;
    } catch (error) {
      this.logger.error(`Error fetching phone number: ${error.message}`);
      return null;
    }
  }

  async deleteInstance(
    instanceName: string,
    instanceServerId?: string,
  ): Promise<void> {
    const config = await this.getServerConfig(instanceServerId);
    try {
      try {
        await firstValueFrom(
          this.httpService.get(
            `${config.apiUrl}/instance/logout/${instanceName}`,
            { headers: config.headers },
          ),
        );
      } catch (e) {
        // Ignore logout errors
      }

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/instance/delete/${instanceName}`,
          { headers: config.headers },
        ),
      );
    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 400) {
        this.logger.warn(
          `Delete instance ${instanceName} returned ${error.response?.status}. Assuming instance is gone.`,
        );
        return;
      }

      this.logger.error(
        `Error deleting instance ${instanceName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async sendTextMessage(
    channelName: string,
    phoneNumber: string,
    text: string,
    instanceServerId?: string,
  ): Promise<any> {
    const config = await this.getServerConfig(instanceServerId);
    try {
      const sanitizedNumber = phoneNumber.includes('@')
        ? phoneNumber
        : phoneNumber.replace(/\D/g, '');

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/message/sendText/${channelName}`,
          {
            number: sanitizedNumber,
            text: text,
            options: {
              delay: 1200,
              presence: 'composing',
              linkPreview: false,
            },
          },
          { headers: config.headers },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Error sending message to ${channelName}: ${error.message} | Response: ${JSON.stringify(error.response?.data)}`,
        error.stack,
      );

      const responseData = error.response?.data?.response;
      if (
        error.response?.status === 400 &&
        responseData?.message?.[0]?.exists === false &&
        phoneNumber.includes('@lid')
      ) {
        const contactName = responseData.message[0].name || 'Contato';
        throw new BadRequestException(
          `Não foi possível enviar mensagem para "${contactName}". Este contato utiliza configurações de privacidade do WhatsApp que ocultam o número de telefone. Atualize a versão da Evolution API para resolver este problema.`,
        );
      }

      throw error;
    }
  }

  async getProfilePicture(
    instanceName: string,
    phoneNumber: string,
    instanceServerId?: string,
  ): Promise<string | null> {
    const config = await this.getServerConfig(instanceServerId);
    try {
      const sanitizedNumber = phoneNumber.includes('@')
        ? phoneNumber
        : phoneNumber.replace(/\D/g, '');
      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/chat/fetchProfilePictureUrl/${instanceName}`,
          { number: sanitizedNumber },
          { headers: config.headers },
        ),
      );
      return response.data?.profilePictureUrl || null;
    } catch (error) {
      this.logger.error(
        `Error fetching profile picture for ${phoneNumber}: ${error.message}`,
      );
      return null;
    }
  }

  async sendMediaMessage(
    instanceName: string,
    phoneNumber: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    fileName?: string,
    caption?: string,
    mimetype?: string,
    instanceServerId?: string,
  ): Promise<any> {
    const config = await this.getServerConfig(instanceServerId);
    try {
      const sanitizedNumber = phoneNumber.includes('@')
        ? phoneNumber
        : phoneNumber.replace(/\D/g, '');
      let finalMedia = mediaUrl;
      let finalMimeType = mimetype;

      if (mediaUrl.startsWith('data:')) {
        const matches = mediaUrl.match(
          /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/,
        );
        if (matches && matches.length === 3) {
          finalMimeType = matches[1];
          finalMedia = matches[2];
        } else {
          finalMedia = mediaUrl.split(',')[1] || mediaUrl;
        }
      }

      if (!finalMimeType) {
        finalMimeType =
          mediaType === 'image'
            ? 'image/jpeg'
            : mediaType === 'video'
              ? 'video/mp4'
              : mediaType === 'audio'
                ? 'audio/mpeg'
                : mediaType === 'document'
                  ? 'application/pdf'
                  : 'application/octet-stream';
      }

      const payload: any = {
        number: sanitizedNumber,
        media: finalMedia,
        mediatype: mediaType,
        mimetype: finalMimeType,
      };

      if (fileName) {
        payload.fileName = fileName;
      }

      if (caption) {
        payload.caption = caption;
      }

      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(
          ([_, v]) => v !== undefined && v !== null && v !== '',
        ),
      );

      this.logger.log(
        `[SEND MEDIA DEBUG] to=${sanitizedNumber} | type=${mediaType} | mime=${finalMimeType}`,
      );

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/message/sendMedia/${instanceName}`,
          cleanPayload,
          { headers: config.headers },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error sending media message to ${instanceName}: ${error.message} | Response: ${JSON.stringify(error.response?.data)}`,
        error.stack,
      );
      throw error;
    }
  }

  async getGroupSubject(
    instanceName: string,
    groupJid: string,
    instanceServerId?: string,
  ): Promise<string | null> {
    const config = await this.getServerConfig(instanceServerId);
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/group/findGroupInfos/${instanceName}?groupJid=${groupJid}`,
          { headers: config.headers },
        ),
      );
      return response.data?.subject || null;
    } catch (error) {
      this.logger.error(
        `Error getting group subject for ${groupJid}: ${error.message}`,
      );
      return null;
    }
  }
}
