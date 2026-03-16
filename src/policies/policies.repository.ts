import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Policy, PolicyDocument } from './schemas/policy.schema';

@Injectable()
export class PoliciesRepository {
  constructor(@InjectModel(Policy.name) private policyModel: Model<PolicyDocument>) {}

  async create(policyData: Partial<Policy>): Promise<PolicyDocument> {
    const policy = new this.policyModel({
      ...policyData,
      issuedAt: new Date(),
    });
    return policy.save();
  }

  async findById(id: string): Promise<PolicyDocument | null> {
    return this.policyModel
      .findById(id)
      .populate('farmerId')
      .populate('farmId')
      .populate('insurerId')
      .populate('assessmentId')
      .exec();
  }

  async findByFarmerId(farmerId: string): Promise<PolicyDocument[]> {
    // Convert string ID to ObjectId for proper MongoDB query
    const farmerObjectId = new Types.ObjectId(farmerId);
    return this.policyModel
      .find({
        $or: [
          { farmerId: farmerObjectId },
          { 'farmerId._id': farmerObjectId },
          { 'farmerId.id': farmerObjectId },
        ],
      })
      .exec();
  }

  async findByInsurerId(insurerId: string): Promise<PolicyDocument[]> {
    // Convert string ID to ObjectId for proper MongoDB query
    const insurerObjectId = new Types.ObjectId(insurerId);
    return this.policyModel
      .find({
        $or: [
          { insurerId: insurerObjectId },
          { 'insurerId._id': insurerObjectId },
          { 'insurerId.id': insurerObjectId },
        ],
      })
      .exec();
  }

  async findByPolicyNumber(policyNumber: string): Promise<PolicyDocument | null> {
    return this.policyModel.findOne({ policyNumber }).exec();
  }

  async findAll(filters?: any): Promise<PolicyDocument[]> {
    return this.policyModel.find(filters || {}).exec();
  }

  async update(id: string, updateData: Partial<Policy>): Promise<PolicyDocument | null> {
    return this.policyModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  generatePolicyNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `POL-${timestamp}-${random}`;
  }
}
