import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Role } from './enums/role.enum';

@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(userData: Partial<User>): Promise<UserDocument> {
    const user = new this.userModel(userData);
    return user.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phoneNumber }).exec();
  }

  async findByNationalId(nationalId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ nationalId }).exec();
  }

  async findAll(
    page: number = 0,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortDirection: 'asc' | 'desc' = 'desc',
  ): Promise<{
    items: UserDocument[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
  }> {
    const skip = page * limit;
    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortDirection === 'asc' ? 1 : -1;

    const [items, totalItems] = await Promise.all([
      this.userModel.find().skip(skip).limit(limit).sort(sort).exec(),
      this.userModel.countDocuments().exec(),
    ]);

    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async update(id: string, updateData: Partial<User>): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async deactivate(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, { active: false }, { new: true })
      .exec();
  }

  async findByRole(
    role: Role,
    page: number = 0,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortDirection: 'asc' | 'desc' = 'desc',
  ): Promise<{
    items: UserDocument[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
  }> {
    const skip = page * limit;
    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortDirection === 'asc' ? 1 : -1;

    const query = { role, active: true }; // Only return active assessors

    const [items, totalItems] = await Promise.all([
      this.userModel.find(query).skip(skip).limit(limit).sort(sort).exec(),
      this.userModel.countDocuments(query).exec(),
    ]);

    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }
}

