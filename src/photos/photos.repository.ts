import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Photo, PhotoDocument } from './schemas/photo.schema';
import { PhotoType } from './enums/photo-type.enum';

@Injectable()
export class PhotosRepository {
  constructor(
    @InjectModel(Photo.name) private photoModel: Model<PhotoDocument>,
  ) {}

  async create(photoData: Partial<Photo>): Promise<PhotoDocument> {
    const photo = new this.photoModel(photoData);
    return photo.save();
  }

  async findById(id: string): Promise<PhotoDocument | null> {
    return this.photoModel.findById(id).exec();
  }

  async findByEntity(
    entityId: string,
    type: PhotoType,
  ): Promise<PhotoDocument[]> {
    return this.photoModel.find({ entityId, type }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.photoModel.findByIdAndDelete(id).exec();
  }
}

