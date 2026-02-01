import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PhotoType } from '../enums/photo-type.enum';

export type PhotoDocument = Photo & Document;

@Schema({ timestamps: true })
export class Photo {
  @Prop({ required: true })
  url: string;

  @Prop({ enum: PhotoType, required: true })
  type: PhotoType;

  @Prop({ required: true })
  entityId: string; // ID of the related entity (assessment, claim, user)

  @Prop()
  originalFileName?: string;

  @Prop()
  mimeType?: string;

  @Prop()
  size?: number; // in bytes
}

export const PhotoSchema = SchemaFactory.createForClass(Photo);

PhotoSchema.index({ entityId: 1, type: 1 });

