import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FarmerProfileDocument = FarmerProfile & Document;

@Schema({ timestamps: true })
export class FarmerProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop()
  farmProvince?: string;

  @Prop()
  farmDistrict?: string;

  @Prop()
  farmSector?: string;

  @Prop()
  farmCell?: string;

  @Prop()
  farmVillage?: string;

  @Prop({ type: String })
  profilePictureUrl?: string | null;
}

export const FarmerProfileSchema =
  SchemaFactory.createForClass(FarmerProfile);


