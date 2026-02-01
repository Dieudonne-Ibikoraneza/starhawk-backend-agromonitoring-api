import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  InsuranceRequest,
  InsuranceRequestDocument,
} from './schemas/insurance-request.schema';

@Injectable()
export class InsuranceRequestsRepository {
  constructor(
    @InjectModel(InsuranceRequest.name)
    private insuranceRequestModel: Model<InsuranceRequestDocument>,
  ) {}

  async create(
    requestData: Partial<InsuranceRequest>,
  ): Promise<InsuranceRequestDocument> {
    const request = new this.insuranceRequestModel({
      ...requestData,
      requestedAt: new Date(),
    });
    return request.save();
  }

  async findById(id: string): Promise<InsuranceRequestDocument | null> {
    return this.insuranceRequestModel
      .findById(id)
      .populate('farmerId')
      .populate('farmId')
      .populate('insurerId')
      .exec();
  }

  async findByFarmerId(farmerId: string): Promise<InsuranceRequestDocument[]> {
    // Convert string farmerId to ObjectId for proper MongoDB query
    return this.insuranceRequestModel
      .find({ farmerId: new Types.ObjectId(farmerId) })
      .populate('farmId')
      .exec();
  }

  async findByInsurerId(
    insurerId: string,
  ): Promise<InsuranceRequestDocument[]> {
    // Convert string insurerId to ObjectId for proper MongoDB query
    return this.insuranceRequestModel
      .find({ insurerId: new Types.ObjectId(insurerId) })
      .populate('farmerId')
      .populate('farmId')
      .exec();
  }

  async findByStatus(
    status: string,
  ): Promise<InsuranceRequestDocument[]> {
    return this.insuranceRequestModel
      .find({ status })
      .populate('farmerId')
      .populate('farmId')
      .exec();
  }

  async update(
    id: string,
    updateData: Partial<InsuranceRequest>,
  ): Promise<InsuranceRequestDocument | null> {
    return this.insuranceRequestModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }
}

