import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { PhotosService } from './photos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PhotoType } from './enums/photo-type.enum';
import { UuidValidationPipe } from '../common/pipes/uuid-validation.pipe';
import { memoryStorage } from 'multer';

@ApiTags('Photos')
@ApiBearerAuth()
@Controller('photos')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload photo' })
  @ApiQuery({ name: 'type', enum: PhotoType, description: 'Photo type' })
  @ApiQuery({ name: 'entityId', description: 'Entity ID (assessment, claim, or user ID)' })
  @ApiResponse({ status: 201 })
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: PhotoType,
    @Query('entityId') entityId: string,
  ) {
    return this.photosService.uploadPhoto(file, type, entityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get photo URL' })
  @ApiResponse({ status: 200 })
  async getPhoto(@Param('id', UuidValidationPipe) id: string) {
    const url = await this.photosService.getPhotoUrl(id);
    return { url };
  }

  @Get('entity/:entityId')
  @ApiOperation({ summary: 'Get photos by entity' })
  @ApiQuery({ name: 'type', enum: PhotoType, description: 'Photo type' })
  @ApiResponse({ status: 200 })
  async getPhotosByEntity(
    @Param('entityId') entityId: string,
    @Query('type') type: PhotoType,
  ) {
    return this.photosService.getPhotosByEntity(entityId, type);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete photo' })
  @ApiResponse({ status: 200 })
  async deletePhoto(@Param('id', UuidValidationPipe) id: string) {
    await this.photosService.deletePhoto(id);
    return { message: 'Photo deleted successfully' };
  }
}

