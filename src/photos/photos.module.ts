import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { PhotosRepository } from './photos.repository';
import { Photo, PhotoSchema } from './schemas/photo.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Photo.name, schema: PhotoSchema }]),
  ],
  controllers: [PhotosController],
  providers: [PhotosService, PhotosRepository],
  exports: [PhotosService],
})
export class PhotosModule {}

