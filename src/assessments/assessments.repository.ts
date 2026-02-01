import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Assessment, AssessmentDocument } from './schemas/assessment.schema';

@Injectable()
export class AssessmentsRepository {
  constructor(
    @InjectModel(Assessment.name)
    private assessmentModel: Model<AssessmentDocument>,
  ) {}

  async create(assessmentData: Partial<Assessment>): Promise<AssessmentDocument> {
    const assessment = new this.assessmentModel({
      ...assessmentData,
      assignedAt: new Date(),
    });
    return assessment.save();
  }

  async findById(id: string): Promise<AssessmentDocument | null> {
    return this.assessmentModel
      .findById(id)
      .populate('farmId')
      .populate('assessorId')
      .populate('insurerId')
      .exec();
  }

  async findByAssessorId(assessorId: string): Promise<AssessmentDocument[]> {
    console.log('Repository: findByAssessorId called with:', assessorId);
    
    // Try both ObjectId and string formats
    let query: any;
    if (Types.ObjectId.isValid(assessorId)) {
      query = { 
        $or: [
          { assessorId: new Types.ObjectId(assessorId) },
          { assessorId: assessorId }
        ]
      };
    } else {
      query = { assessorId: assessorId };
    }
    
    console.log('Repository: Query:', JSON.stringify(query));
    
    const assessments = await this.assessmentModel
      .find(query)
      .populate('farmId')
      .populate('assessorId')
      .populate('insurerId')
      .exec();
    
    console.log(`Repository: Found ${assessments.length} assessments`);
    return assessments;
  }

  async findByInsurerId(insurerId: string): Promise<AssessmentDocument[]> {
    console.log('Repository: findByInsurerId called with:', insurerId);
    
    // Try both ObjectId and string formats
    let query: any;
    if (Types.ObjectId.isValid(insurerId)) {
      query = { 
        $or: [
          { insurerId: new Types.ObjectId(insurerId) },
          { insurerId: insurerId }
        ]
      };
    } else {
      query = { insurerId: insurerId };
    }
    
    console.log('Repository: Query:', JSON.stringify(query));
    
    const assessments = await this.assessmentModel
      .find(query)
      .populate('farmId')
      .populate('assessorId')
      .populate('insurerId')
      .exec();
    
    console.log(`Repository: Found ${assessments.length} assessments`);
    return assessments;
  }

  async findAll(): Promise<AssessmentDocument[]> {
    console.log('Repository: findAll called');
    const count = await this.assessmentModel.countDocuments().exec();
    console.log(`Repository: Total assessments in database: ${count}`);
    
    const assessments = await this.assessmentModel
      .find()
      .populate('farmId')
      .populate('assessorId')
      .populate('insurerId')
      .exec();
    
    console.log(`Repository: Retrieved ${assessments.length} assessments after populate`);
    return assessments;
  }

  async findByFarmId(farmId: string): Promise<AssessmentDocument | null> {
    return this.assessmentModel.findOne({ farmId }).exec();
  }

  async isAssessorAssignedToFarm(
    assessorId: string,
    farmId: string,
  ): Promise<boolean> {
    const assessment = await this.assessmentModel
      .findOne({
        assessorId: new Types.ObjectId(assessorId),
        farmId: new Types.ObjectId(farmId),
      })
      .exec();
    return assessment !== null;
  }

  async findByStatus(status: string): Promise<AssessmentDocument[]> {
    return this.assessmentModel
      .find({ status })
      .populate('farmId')
      .exec();
  }

  async update(
    id: string,
    updateData: Partial<Assessment>,
  ): Promise<AssessmentDocument | null> {
    return this.assessmentModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async isAssessorAssignedToFarmer(
    assessorId: string,
    farmerId: string,
  ): Promise<boolean> {
    const assessments = await this.assessmentModel
      .find({ assessorId: new Types.ObjectId(assessorId) })
      .populate({
        path: 'farmId',
        populate: { path: 'farmerId' },
      })
      .exec();

    // Check if any assessment's farm belongs to the farmer
    return assessments.some((assessment) => {
      const farm = assessment.farmId as any;
      if (!farm) return false;
      
      // Handle both populated and unpopulated farmerId
      let farmFarmerId: string | null = null;
      if (farm.farmerId) {
        if (farm.farmerId instanceof Types.ObjectId) {
          farmFarmerId = farm.farmerId.toString();
        } else if (farm.farmerId._id) {
          farmFarmerId = farm.farmerId._id.toString();
        } else {
          farmFarmerId = String(farm.farmerId);
        }
      }
      
      return farmFarmerId === farmerId;
    });
  }
}

