import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Farm, FarmDocument } from './schemas/farm.schema';
import { FarmStatus } from './enums/farm-status.enum';

@Injectable()
export class FarmsRepository {
  constructor(@InjectModel(Farm.name) private farmModel: Model<FarmDocument>) {}

  async create(farmData: Partial<Farm>): Promise<FarmDocument> {
    const farm = new this.farmModel(farmData);
    return farm.save();
  }

  async findById(id: string): Promise<FarmDocument | null> {
    return this.farmModel.findById(id).populate('farmerId').exec();
  }

  async findByFarmerId(farmerId: string): Promise<FarmDocument[]> {
    // Convert string farmerId to ObjectId for proper MongoDB query
    return this.farmModel.find({ farmerId: new Types.ObjectId(farmerId) }).exec();
  }

  async findAll(
    page: number = 0,
    limit: number = 10,
    filters?: any,
  ): Promise<{
    items: FarmDocument[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
  }> {
    const skip = page * limit;
    const query = this.farmModel.find(filters || {});

    const [items, totalItems] = await Promise.all([
      query.skip(skip).limit(limit).populate('farmerId').exec(),
      this.farmModel.countDocuments(filters || {}).exec(),
    ]);

    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async update(id: string, updateData: Partial<Farm>): Promise<FarmDocument | null> {
    return this.farmModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string): Promise<void> {
    await this.farmModel.findByIdAndDelete(id).exec();
  }

  async findByStatus(status: FarmStatus): Promise<FarmDocument[]> {
    return this.farmModel
      .find({ status })
      .populate('farmerId')
      .exec();
  }
}

