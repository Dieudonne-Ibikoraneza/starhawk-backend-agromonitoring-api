import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhotosRepository } from './photos.repository';
import { PhotoType } from './enums/photo-type.enum';
import { PhotoDocument } from './schemas/photo.schema';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class PhotosService {
  private readonly uploadDir: string;

  constructor(
    private photosRepository: PhotosRepository,
    private configService: ConfigService,
  ) {
    this.uploadDir =
      this.configService.get<string>('UPLOAD_DIR', './uploads/photos');
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory(): void {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadPhoto(
    file: Express.Multer.File,
    type: PhotoType,
    entityId: string,
  ): Promise<{ id: string; url: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only images are allowed.',
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const extension = file.originalname.split('.').pop();
    const filename = `${type.toLowerCase()}-${entityId}-${timestamp}-${randomStr}.${extension}`;

    // Save file
    const filePath = join(this.uploadDir, filename);
    writeFileSync(filePath, file.buffer);

    // Create relative URL
    const url = `/uploads/photos/${filename}`;

    // Save photo record
    const photo = await this.photosRepository.create({
      url,
      type,
      entityId,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    return {
      id: (photo._id as any).toString(),
      url,
    };
  }

  async getPhotoUrl(id: string): Promise<string | null> {
    const photo = await this.photosRepository.findById(id);
    return photo ? photo.url : null;
  }

  async getPhotosByEntity(
    entityId: string,
    type: PhotoType,
  ): Promise<PhotoDocument[]> {
    return this.photosRepository.findByEntity(entityId, type);
  }

  async deletePhoto(id: string): Promise<void> {
    const photo = await this.photosRepository.findById(id);
    if (!photo) {
      throw new BadRequestException('Photo not found');
    }

    // Delete file from filesystem
    const filePath = join(process.cwd(), photo.url);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    // Delete record
    await this.photosRepository.delete(id);
  }
}

