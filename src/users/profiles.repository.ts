import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FarmerProfile, FarmerProfileDocument } from './schemas/farmer-profile.schema';
import {
  AssessorProfile,
  AssessorProfileDocument,
} from './schemas/assessor-profile.schema';
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
    @InjectModel(InsurerProfile.name)
    private insurerProfileModel: Model<InsurerProfileDocument>,
  ) {}

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
    return this.farmerProfileModel.findOne({ userId }).exec();
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
}

