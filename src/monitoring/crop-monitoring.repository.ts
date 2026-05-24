import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CropMonitoring, CropMonitoringDocument } from './schemas/crop-monitoring.schema';
import { CropMonitoringCycle, CropMonitoringCycleDocument } from './schemas/crop-monitoring-cycle.schema';

@Injectable()
export class CropMonitoringRepository {
  constructor(
    @InjectModel(CropMonitoring.name)
    private cropMonitoringModel: Model<CropMonitoringDocument>,
    @InjectModel(CropMonitoringCycle.name)
    private cropMonitoringCycleModel: Model<CropMonitoringCycleDocument>,
  ) {}

  // ---------------- Parent Methods ----------------

  async createParent(data: Partial<CropMonitoring>): Promise<CropMonitoringDocument> {
    const parent = new this.cropMonitoringModel(data);
    return parent.save();
  }

  async findParentById(id: string): Promise<CropMonitoringDocument | null> {
    return this.cropMonitoringModel
      .findById(id)
      .populate({
        path: 'policyId',
        populate: { path: 'farmerId' }
      })
      .populate('farmId')
      .populate('assessorId')
      .exec();
  }

  async findParentByPolicyId(policyId: string): Promise<CropMonitoringDocument | null> {
    return this.cropMonitoringModel
      .findOne({ policyId: new Types.ObjectId(policyId) })
      .populate({
        path: 'policyId',
        populate: { path: 'farmerId' }
      })
      .populate('farmId')
      .populate('assessorId')
      .exec();
  }

  async findParentByFarmId(farmId: string): Promise<CropMonitoringDocument | null> {
    return this.cropMonitoringModel
      .findOne({ farmId: new Types.ObjectId(farmId) })
      .populate({
        path: 'policyId',
        populate: { path: 'farmerId' }
      })
      .populate('farmId')
      .populate('assessorId')
      .exec();
  }

  async updateParent(
    id: string,
    updateData: Partial<CropMonitoring>,
  ): Promise<CropMonitoringDocument | null> {
    return this.cropMonitoringModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate({
        path: 'policyId',
        populate: { path: 'farmerId' }
      })
      .populate('farmId')
      .populate('assessorId')
      .exec();
  }

  async findParentsByAssessorId(assessorId: string): Promise<CropMonitoringDocument[]> {
    return this.cropMonitoringModel
      .find({ assessorId: new Types.ObjectId(assessorId) })
      .populate({
        path: 'policyId',
        populate: { path: 'farmerId' }
      })
      .populate('farmId')
      .populate('assessorId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findParentsByPolicyIds(policyIds: Types.ObjectId[]): Promise<CropMonitoringDocument[]> {
    return this.cropMonitoringModel
      .find({ policyId: { $in: policyIds } })
      .populate({
        path: 'policyId',
        populate: { path: 'farmerId' }
      })
      .populate('farmId')
      .populate('assessorId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAllParents(): Promise<CropMonitoringDocument[]> {
    return this.cropMonitoringModel
      .find()
      .populate({
        path: 'policyId',
        populate: { path: 'farmerId' }
      })
      .populate('farmId')
      .populate('assessorId')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ---------------- Cycle Methods ----------------

  async createCycle(data: Partial<CropMonitoringCycle>): Promise<CropMonitoringCycleDocument> {
    const cycle = new this.cropMonitoringCycleModel(data);
    return cycle.save();
  }

  async findCyclesByParentId(parentId: string): Promise<CropMonitoringCycleDocument[]> {
    return this.cropMonitoringCycleModel
      .find({ cropMonitoringId: new Types.ObjectId(parentId) })
      .sort({ monitoringNumber: 1 })
      .exec();
  }

  async findCycleById(cycleId: string): Promise<CropMonitoringCycleDocument | null> {
    return this.cropMonitoringCycleModel.findById(cycleId).exec();
  }

  async updateCycle(
    cycleId: string,
    updateData: Partial<CropMonitoringCycle>,
  ): Promise<CropMonitoringCycleDocument | null> {
    return this.cropMonitoringCycleModel
      .findByIdAndUpdate(cycleId, updateData, { new: true })
      .exec();
  }

  async countCyclesByParentId(parentId: string): Promise<number> {
    return this.cropMonitoringCycleModel
      .countDocuments({ cropMonitoringId: new Types.ObjectId(parentId) })
      .exec();
  }
}
