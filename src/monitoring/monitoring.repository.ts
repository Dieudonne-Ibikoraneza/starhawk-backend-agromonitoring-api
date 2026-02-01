import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MonitoringRecord,
  MonitoringRecordDocument,
} from './schemas/monitoring-record.schema';

@Injectable()
export class MonitoringRepository {
  constructor(
    @InjectModel(MonitoringRecord.name)
    private monitoringModel: Model<MonitoringRecordDocument>,
  ) {}

  async create(
    recordData: Partial<MonitoringRecord>,
  ): Promise<MonitoringRecordDocument> {
    const record = new this.monitoringModel(recordData);
    return record.save();
  }

  async findByFarmId(farmId: string): Promise<MonitoringRecordDocument[]> {
    return this.monitoringModel
      .find({ farmId })
      .sort({ monitoredAt: -1 })
      .limit(30)
      .exec();
  }

  async findLatestByFarmId(
    farmId: string,
  ): Promise<MonitoringRecordDocument | null> {
    return this.monitoringModel
      .findOne({ farmId })
      .sort({ monitoredAt: -1 })
      .exec();
  }
}

