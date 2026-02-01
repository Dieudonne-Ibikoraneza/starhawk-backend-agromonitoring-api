import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Claim, ClaimDocument } from './schemas/claim.schema';

@Injectable()
export class ClaimsRepository {
  constructor(
    @InjectModel(Claim.name) private claimModel: Model<ClaimDocument>,
  ) {}

  async create(claimData: Partial<Claim>): Promise<ClaimDocument> {
    const claim = new this.claimModel(claimData);
    return claim.save();
  }

  async findById(id: string): Promise<ClaimDocument | null> {
    return this.claimModel
      .findById(id)
      .populate('policyId')
      .populate('farmerId')
      .populate('farmId')
      .populate('assessorId')
      .exec();
  }

  async findByFarmerId(farmerId: string): Promise<ClaimDocument[]> {
    return this.claimModel
      .find({ farmerId })
      .populate('policyId')
      .populate('farmId')
      .exec();
  }

  async findByStatus(status: string): Promise<ClaimDocument[]> {
    return this.claimModel.find({ status }).populate('farmerId').exec();
  }

  async findByAssessorId(assessorId: string): Promise<ClaimDocument[]> {
    return this.claimModel
      .find({ assessorId })
      .populate('policyId')
      .populate('farmId')
      .exec();
  }

  async findAll(): Promise<ClaimDocument[]> {
    return this.claimModel
      .find()
      .populate('policyId')
      .populate('farmerId')
      .populate('farmId')
      .populate('assessorId')
      .exec();
  }

  async update(
    id: string,
    updateData: Partial<Claim>,
  ): Promise<ClaimDocument | null> {
    return this.claimModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }
}

