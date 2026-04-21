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

  @Prop({ type: String })
  companyLogoUrl?: string | null;

  @Prop()
  bio?: string;

  @Prop({ type: String })
  profilePictureUrl?: string | null;

  @Prop()
  province?: string;

  @Prop()
  district?: string;

  @Prop()
  sector?: string;

  @Prop()
  cell?: string;

  @Prop()
  village?: string;

  @Prop()
  officialEmail?: string;

  @Prop()
  officialPhone?: string;

  @Prop({ type: [String] })
  specializations?: string[];

  @Prop({ type: Object })
  socialMedia?: {
    twitter?: string;
    linkedin?: string;
    facebook?: string;
    instagram?: string;
  };
}

export const InsurerProfileSchema =
  SchemaFactory.createForClass(InsurerProfile);

