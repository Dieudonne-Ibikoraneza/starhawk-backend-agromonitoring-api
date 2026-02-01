import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InsurerProfileDocument = InsurerProfile & Document;

@Schema({ timestamps: true })
export class InsurerProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop()
  companyName?: string;

  @Prop()
  contactPerson?: string;

  @Prop()
  website?: string;

  @Prop({ type: String })
  address?: string;

  @Prop({ type: String })
  companyDescription?: string;

  @Prop()
  licenseNumber?: string;

  @Prop({ type: Date })
  registrationDate?: Date;

  @Prop()
  companyLogoUrl?: string;
}

export const InsurerProfileSchema =
  SchemaFactory.createForClass(InsurerProfile);

InsurerProfileSchema.index({ userId: 1 });

