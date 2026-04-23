import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhotosRepository } from './photos.repository';
import { PhotoType } from './enums/photo-type.enum';
import { PhotoDocument } from './schemas/photo.schema';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProfilesRepository } from '../users/profiles.repository';
import { UsersRepository } from '../users/users.repository';
import { Role } from '../users/enums/role.enum';
import { join } from 'path';

@Injectable()
export class PhotosService {
  private readonly supabase: SupabaseClient;
  private readonly bucket: string;

  constructor(
    private photosRepository: PhotosRepository,
    private configService: ConfigService,
    private usersRepository: UsersRepository,
    private profilesRepository: ProfilesRepository,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');
    this.bucket = this.configService.get<string>('SUPABASE_BUCKET', 'photos');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Key must be provided in .env');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
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
    const filename = `${type.toLowerCase()}/${entityId}-${timestamp}-${randomStr}.${extension}`;

    // Auto-delete existing photo for PROFILE or LOGO types to save storage
    if (type === PhotoType.PROFILE || type === PhotoType.LOGO) {
      const existingPhotos = await this.photosRepository.findByEntity(entityId, type);
      for (const oldPhoto of existingPhotos) {
        await this.deleteFromStorage(oldPhoto);
      }
    }

    // Upload to Supabase
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new BadRequestException(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(filename);

    const url = publicUrlData.publicUrl;

    // Save photo record
    const photo = await this.photosRepository.create({
      url,
      type,
      entityId,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    // Auto-map to profile if type is PROFILE or LOGO
    if (type === PhotoType.PROFILE || type === PhotoType.LOGO) {
      await this.autoMapPhotoToProfile(entityId, type, url);
    }

    return {
      id: (photo._id as any).toString(),
      url,
    };
  }

  /**
   * Clear a profile photo or logo and reset the field in the database
   */
  async clearProfilePhoto(
    entityId: string,
    type: PhotoType,
  ): Promise<{ message: string }> {
    const existingPhotos = await this.photosRepository.findByEntity(entityId, type);
    
    for (const photo of existingPhotos) {
      await this.deleteFromStorage(photo);
    }

    // Reset the mapping in the profile (pass null to clear)
    await this.autoMapPhotoToProfile(entityId, type, null);

    return { message: `${type} cleared successfully` };
  }

  /**
   * Automatically update the corresponding user profile with the new photo URL
   */
  private async autoMapPhotoToProfile(
    userId: string,
    type: PhotoType,
    url: string | null,
  ): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      console.warn(`AutoMap: User ${userId} not found`);
      return;
    }

    console.log(`AutoMap: Updating ${user.role} profile for ${userId} with URL: ${url}`);

    if (type === PhotoType.PROFILE) {
      // Profile Picture
      switch (user.role) {
        case Role.ASSESSOR:
          const result = await this.profilesRepository.updateAssessorProfile(userId, {
            profilePhotoUrl: url,
          });
          console.log(`AutoMap: Assessor update ${result ? 'succeeded' : 'failed'}`);
          break;
        case Role.INSURER:
          const insResult = await this.profilesRepository.updateInsurerProfile(userId, {
            profilePictureUrl: url,
          });
          console.log(`AutoMap: Insurer update ${insResult ? 'succeeded' : 'failed'}`);
          break;
        case Role.FARMER:
          await this.profilesRepository.updateFarmerProfile(userId, {
            // Add field if farmers get profile pics later
          } as any);
          break;
      }
    } else if (type === PhotoType.LOGO && user.role === Role.INSURER) {
      // Company Logo
      const logoResult = await this.profilesRepository.updateInsurerProfile(userId, {
        companyLogoUrl: url,
      });
      console.log(`AutoMap: Logo update ${logoResult ? 'succeeded' : 'failed'}`);
    }
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

    await this.deleteFromStorage(photo);
  }

  /**
   * Delete all photos associated with an entity (used for account deletion)
   */
  async deleteAllEntityPhotos(entityId: string): Promise<void> {
    // Find all photos for this entity (across all types)
    // We'll need a new repository method or a more general search
    const photos = await this.photosRepository.findByEntityOnly(entityId);
    for (const photo of photos) {
      await this.deleteFromStorage(photo);
    }
  }

  /**
   * Internal helper to delete a photo from both Supabase and MongoDB
   */
  private async deleteFromStorage(photo: PhotoDocument): Promise<void> {
    // Extract filename from URL (Supabase URL pattern)
    // URL looks like: https://...supabase.co/storage/v1/object/public/photos/type/filename.ext
    const urlParts = photo.url.split('/');
    const filename = urlParts.slice(-2).join('/'); // type/filename.ext

    // Delete from Supabase
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([filename]);

    if (error) {
      console.error(`Failed to delete from Supabase: ${error.message}`);
    }

    // Delete record from database
    await this.photosRepository.delete((photo._id as any).toString());
  }
}

