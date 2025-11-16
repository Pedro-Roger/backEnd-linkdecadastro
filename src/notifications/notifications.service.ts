import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listNotifications(
    userId: string,
    status?: string | null,
    limit: number = 50,
  ) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(status && { status: status as any }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        status: 'UNREAD',
      },
    });

    return {
      notifications,
      unreadCount,
    };
  }

  async updateNotificationStatus(
    userId: string,
    notificationId: string,
    status: string,
  ) {
    if (!notificationId || !status) {
      throw new BadRequestException(
        'notificationId e status são obrigatórios',
      );
    }

    const notification = await this.prisma.notification.update({
      where: {
        id: notificationId,
        userId,
      },
      data: { status: status as any },
    });

    return notification;
  }
}


