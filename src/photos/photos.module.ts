import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { PhotosRepository } from './photos.repository';
import { Photo, PhotoSchema } from './schemas/photo.schema';

import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Photo.name, schema: PhotoSchema }]),
    forwardRef(() => UsersModule),
  ],
  controllers: [PhotosController],
  providers: [PhotosService, PhotosRepository],
  exports: [PhotosService],
})
export class PhotosModule {}

