import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Alert, AlertDocument } from './schemas/alert.schema';

@Injectable()
export class AlertsRepository {
  constructor(
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
  ) {}

  async create(alertData: Partial<Alert>): Promise<AlertDocument> {
    const alert = new this.alertModel(alertData);
    return alert.save();
  }

  async findByFarmId(farmId: string): Promise<AlertDocument[]> {
    return this.alertModel
      .find({ farmId })
      .sort({ sentAt: -1 })
      .exec();
  }

  async findByPolicyId(policyId: string): Promise<AlertDocument[]> {
    return this.alertModel
      .find({ policyId })
      .sort({ sentAt: -1 })
      .exec();
  }

  async findUnread(farmId?: string): Promise<AlertDocument[]> {
    const query = farmId ? { farmId, readAt: null } : { readAt: null };
    return this.alertModel.find(query).sort({ sentAt: -1 }).exec();
  }

  async markAsRead(alertId: string): Promise<AlertDocument | null> {
    return this.alertModel
      .findByIdAndUpdate(alertId, { readAt: new Date() }, { new: true })
      .exec();
  }
}

