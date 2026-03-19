import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CropMonitoring, CropMonitoringDocument } from './schemas/crop-monitoring.schema';
import { Types } from 'mongoose';

@Injectable()
export class CropMonitoringRepository {
  constructor(
    @InjectModel(CropMonitoring.name)
    private cropMonitoringModel: Model<CropMonitoringDocument>,
  ) {}

  async create(data: Partial<CropMonitoring>): Promise<CropMonitoringDocument> {
    const cropMonitoring = new this.cropMonitoringModel(data);
    return cropMonitoring.save();
  }

  async findById(id: string): Promise<CropMonitoringDocument | null> {
    return this.cropMonitoringModel
      .findById(id)
      .populate('policyId')
      .populate('farmId')
      .populate('assessorId')
      .exec();
  }

  async findByPolicyId(policyId: string): Promise<CropMonitoringDocument[]> {
    return this.cropMonitoringModel
      .find({ policyId: new Types.ObjectId(policyId) })
      .populate('policyId')
      .populate('farmId')
      .populate('assessorId')
      .sort({ monitoringNumber: 1 })
      .exec();
  }

  async findByAssessorId(assessorId: string): Promise<CropMonitoringDocument[]> {
    return this.cropMonitoringModel
      .find({ assessorId: new Types.ObjectId(assessorId) })
      .populate('policyId')
      .populate('farmId')
      .populate('assessorId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async countByPolicyId(policyId: string): Promise<number> {
    const objectId = new Types.ObjectId(policyId);
    console.log(' Counting monitoring cycles for policy:', {
      policyId,
      objectId,
      objectIdString: objectId.toString(),
    });

    const result = await this.cropMonitoringModel.countDocuments({ policyId: objectId }).exec();

    console.log(' Count result:', result);
    return result;
  }

  async update(
    id: string,
    updateData: Partial<CropMonitoring>,
  ): Promise<CropMonitoringDocument | null> {
    return this.cropMonitoringModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('policyId')
      .populate('farmId')
      .populate('assessorId')
      .exec();
  }

  async findAll(): Promise<CropMonitoringDocument[]> {
    return this.cropMonitoringModel
      .find()
      .populate('policyId')
      .populate('farmId')
      .populate('assessorId')
      .sort({ createdAt: -1 })
      .exec();
  }
}
