import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AssessorProfileDocument = AssessorProfile & Document;

@Schema({ timestamps: true })
export class AssessorProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: String })
  specialization?: string;

  @Prop({ type: Number })
  experienceYears?: number;

  @Prop()
  profilePhotoUrl?: string;

  @Prop({ type: String })
  bio?: string;

  @Prop({ type: String })
  address?: string;
}

export const AssessorProfileSchema =
  SchemaFactory.createForClass(AssessorProfile);

AssessorProfileSchema.index({ userId: 1 });

