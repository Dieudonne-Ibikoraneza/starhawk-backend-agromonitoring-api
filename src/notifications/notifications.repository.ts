import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(data: Partial<Notification>): Promise<NotificationDocument> {
    const createdNotification = new this.notificationModel(data);
    return createdNotification.save();
  }

  async findByUserId(userId: string, unreadOnly: boolean = false): Promise<NotificationDocument[]> {
    const query: any = { userId: new Types.ObjectId(userId) };
    if (unreadOnly) {
      query.read = false;
    }
    return this.notificationModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<NotificationDocument | null> {
    return this.notificationModel.findById(new Types.ObjectId(id)).exec();
  }

  async markAsRead(id: string): Promise<NotificationDocument | null> {
    return this.notificationModel
      .findByIdAndUpdate(new Types.ObjectId(id), { read: true }, { new: true })
      .exec();
  }

  async markAsUnread(id: string): Promise<NotificationDocument | null> {
    return this.notificationModel
      .findByIdAndUpdate(new Types.ObjectId(id), { read: false }, { new: true })
      .exec();
  }

  async delete(id: string): Promise<NotificationDocument | null> {
    return this.notificationModel.findByIdAndDelete(new Types.ObjectId(id)).exec();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel
      .updateMany({ userId: new Types.ObjectId(userId), read: false }, { read: true })
      .exec();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({ userId: new Types.ObjectId(userId), read: false })
      .exec();
  }
}
