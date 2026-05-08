import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Claim, ClaimDocument } from './schemas/claim.schema';
import { ClaimType } from './enums/claim-type.enum';

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
      .populate('assessmentReportId')
      .exec();
  }

  async findByFarmerId(farmerId: string): Promise<ClaimDocument[]> {
    const farmerObjectId = new Types.ObjectId(farmerId);
    return this.claimModel
      .find({
        $or: [
          { farmerId: farmerObjectId },
          { 'farmerId._id': farmerObjectId },
          { 'farmerId.id': farmerObjectId },
        ],
      })
      .populate('policyId')
      .populate('farmId')
      .populate('assessmentReportId')
      .exec();
  }

  async findByStatus(status: string): Promise<ClaimDocument[]> {
    return this.claimModel.find({ status }).populate('farmerId').exec();
  }

  async findByPolicyAndType(policyId: string, claimType: ClaimType): Promise<ClaimDocument | null> {
    return this.claimModel
      .findOne({
        policyId: new Types.ObjectId(policyId),
        claimType,
      })
      .populate('policyId')
      .populate('farmerId')
      .populate('farmId')
      .populate('assessorId')
      .populate('assessmentReportId')
      .exec();
  }

  async findByAssessorId(assessorId: string): Promise<ClaimDocument[]> {
    const assessorObjectId = new Types.ObjectId(assessorId);
    return this.claimModel
      .find({
        $or: [
          { assessorId: assessorObjectId },
          { 'assessorId._id': assessorObjectId },
          { 'assessorId.id': assessorObjectId },
        ],
      })
      .populate('policyId')
      .populate('farmerId')
      .populate('farmId')
      .populate('assessmentReportId')
      .exec();
  }

  async findAll(): Promise<ClaimDocument[]> {
    return this.claimModel
      .find()
      .populate('policyId')
      .populate('farmerId')
      .populate('farmId')
      .populate('assessorId')
      .populate('assessmentReportId')
      .exec();
  }

  async update(
    id: string,
    updateData: Partial<Claim>,
  ): Promise<ClaimDocument | null> {
    return this.claimModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('assessmentReportId')
      .exec();
  }
}

