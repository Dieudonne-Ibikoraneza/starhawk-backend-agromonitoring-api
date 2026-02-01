import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ClaimAssessment,
  ClaimAssessmentDocument,
} from './schemas/claim-assessment.schema';

@Injectable()
export class ClaimAssessmentsRepository {
  constructor(
    @InjectModel(ClaimAssessment.name)
    private assessmentModel: Model<ClaimAssessmentDocument>,
  ) {}

  async create(
    assessmentData: Partial<ClaimAssessment>,
  ): Promise<ClaimAssessmentDocument> {
    const assessment = new this.assessmentModel(assessmentData);
    return assessment.save();
  }

  async findById(id: string): Promise<ClaimAssessmentDocument | null> {
    return this.assessmentModel
      .findById(id)
      .populate('claimId')
      .populate('assessorId')
      .exec();
  }

  async findByClaimId(claimId: string): Promise<ClaimAssessmentDocument | null> {
    return this.assessmentModel.findOne({ claimId }).exec();
  }

  async update(
    id: string,
    updateData: Partial<ClaimAssessment>,
  ): Promise<ClaimAssessmentDocument | null> {
    return this.assessmentModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }
}

