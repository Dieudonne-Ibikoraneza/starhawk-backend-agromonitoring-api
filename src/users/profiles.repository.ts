import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FarmerProfile, FarmerProfileDocument } from './schemas/farmer-profile.schema';
import {
  AssessorProfile,
  AssessorProfileDocument,
} from './schemas/assessor-profile.schema';
import {
  GovernmentProfile,
  GovernmentProfileDocument,
} from './schemas/government-profile.schema';
import {
  InsurerProfile,
  InsurerProfileDocument,
} from './schemas/insurer-profile.schema';

@Injectable()
export class ProfilesRepository {
  constructor(
    @InjectModel(FarmerProfile.name)
    private farmerProfileModel: Model<FarmerProfileDocument>,
    @InjectModel(AssessorProfile.name)
    private assessorProfileModel: Model<AssessorProfileDocument>,
    @InjectModel(GovernmentProfile.name)
    private governmentProfileModel: Model<GovernmentProfileDocument>,
    @InjectModel(InsurerProfile.name)
    private insurerProfileModel: Model<InsurerProfileDocument>,
  ) {}

  private normalizeGovernmentProfileData(
    profileData: Partial<GovernmentProfile>,
  ): Partial<GovernmentProfile> {
    const normalized = { ...profileData };
    if (
      normalized.parentGovernmentUserId &&
      typeof normalized.parentGovernmentUserId === 'string' &&
      Types.ObjectId.isValid(normalized.parentGovernmentUserId)
    ) {
      normalized.parentGovernmentUserId = new Types.ObjectId(
        normalized.parentGovernmentUserId,
      );
    }
    return normalized;
  }

  // Farmer Profile
  async createFarmerProfile(
    userId: string,
    profileData: Partial<FarmerProfile>,
  ): Promise<FarmerProfileDocument> {
    const profile = new this.farmerProfileModel({
      ...profileData,
      userId,
    });
    return profile.save();
  }

  async findFarmerProfileByUserId(
    userId: string,
  ): Promise<FarmerProfileDocument | null> {
    const queryIds: any[] = [userId];
    if (Types.ObjectId.isValid(userId)) {
      queryIds.push(new Types.ObjectId(userId));
    }
    return this.farmerProfileModel.findOne({ userId: { $in: queryIds } }).exec();
  }

  async findFarmerProfilesByUserIds(
    userIds: string[],
  ): Promise<FarmerProfileDocument[]> {
    const oids = userIds.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id));
    const queryIds = [...userIds, ...oids];
    return this.farmerProfileModel.find({ userId: { $in: queryIds } }).exec();
  }

  async updateFarmerProfile(
    userId: string,
    updateData: Partial<FarmerProfile>,
  ): Promise<FarmerProfileDocument | null> {
    return this.farmerProfileModel
      .findOneAndUpdate({ userId }, updateData, { new: true })
      .exec();
  }

  // Assessor Profile
  async createAssessorProfile(
    userId: string,
    profileData: Partial<AssessorProfile>,
  ): Promise<AssessorProfileDocument> {
    const profile = new this.assessorProfileModel({
      ...profileData,
      userId,
    });
    return profile.save();
  }

  async findAssessorProfileByUserId(
    userId: string,
  ): Promise<AssessorProfileDocument | null> {
    return this.assessorProfileModel.findOne({ userId }).exec();
  }

  async updateAssessorProfile(
    userId: string,
    updateData: Partial<AssessorProfile>,
  ): Promise<AssessorProfileDocument | null> {
    return this.assessorProfileModel
      .findOneAndUpdate({ userId }, updateData, { new: true })
      .exec();
  }

  // Government Profile
  async createGovernmentProfile(
    userId: string,
    profileData: Partial<GovernmentProfile>,
  ): Promise<GovernmentProfileDocument> {
    const profile = new this.governmentProfileModel({
      ...this.normalizeGovernmentProfileData(profileData),
      userId,
    });
    return profile.save();
  }

  async findGovernmentProfileByUserId(
    userId: string,
  ): Promise<GovernmentProfileDocument | null> {
    return this.governmentProfileModel.findOne({ userId }).exec();
  }

  async updateGovernmentProfile(
    userId: string,
    updateData: Partial<GovernmentProfile>,
  ): Promise<GovernmentProfileDocument | null> {
    return this.governmentProfileModel
      .findOneAndUpdate(
        { userId },
        this.normalizeGovernmentProfileData(updateData),
        { new: true },
      )
      .exec();
  }

  // Insurer Profile
  async createInsurerProfile(
    userId: string,
    profileData: Partial<InsurerProfile>,
  ): Promise<InsurerProfileDocument> {
    const profile = new this.insurerProfileModel({
      ...profileData,
      userId,
    });
    return profile.save();
  }

  async findInsurerProfileByUserId(
    userId: string,
  ): Promise<InsurerProfileDocument | null> {
    return this.insurerProfileModel.findOne({ userId }).exec();
  }

  async updateInsurerProfile(
    userId: string,
    updateData: Partial<InsurerProfile>,
  ): Promise<InsurerProfileDocument | null> {
    return this.insurerProfileModel
      .findOneAndUpdate({ userId }, updateData, { new: true })
      .exec();
  }

  // Deletion
  async deleteFarmerProfile(userId: string): Promise<void> {
    await this.farmerProfileModel.deleteOne({ userId }).exec();
  }

  async deleteAssessorProfile(userId: string): Promise<void> {
    await this.assessorProfileModel.deleteOne({ userId }).exec();
  }

  async deleteGovernmentProfile(userId: string): Promise<void> {
    await this.governmentProfileModel.deleteOne({ userId }).exec();
  }

  async deleteInsurerProfile(userId: string): Promise<void> {
    await this.insurerProfileModel.deleteOne({ userId }).exec();
  }
}

