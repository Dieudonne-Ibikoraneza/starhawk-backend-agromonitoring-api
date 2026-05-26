import { Injectable, Logger } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { NotificationType } from './enums/notification-type.enum';
import { Types } from 'mongoose';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    referenceId?: string,
    referenceType?: string,
  ) {
    try {
      const notificationData: any = {
        userId: new Types.ObjectId(userId),
        title,
        message,
        type,
      };

      if (referenceId) {
        notificationData.referenceId = new Types.ObjectId(referenceId);
      }
      if (referenceType) {
        notificationData.referenceType = referenceType;
      }

      return await this.notificationsRepository.create(notificationData);
    } catch (error) {
      this.logger.error(`Failed to create notification for user ${userId}`, error.stack);
      throw error;
    }
  }

  async getUserNotifications(userId: string, unreadOnly: boolean = false) {
    return this.notificationsRepository.findByUserId(userId, unreadOnly);
  }

  async getUnreadCount(userId: string) {
    return this.notificationsRepository.getUnreadCount(userId);
  }

  async markAsRead(notificationId: string, userId: string) {
    // In a real app, verify the notification belongs to userId
    return this.notificationsRepository.markAsRead(notificationId);
  }

  async markAsUnread(notificationId: string, userId: string) {
    // In a real app, verify the notification belongs to userId
    return this.notificationsRepository.markAsUnread(notificationId);
  }

  async deleteNotification(notificationId: string, userId: string) {
    // In a real app, verify the notification belongs to userId
    return this.notificationsRepository.delete(notificationId);
  }

  async markAllAsRead(userId: string) {
    return this.notificationsRepository.markAllAsRead(userId);
  }
}
