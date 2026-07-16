import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { GovernmentLevel } from '../../users/enums/government-level.enum';

export type RegionDocument = Region & Document;

@Schema({ timestamps: true })
export class Region {
  @Prop({ type: String, required: true, unique: true })
  regionId: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, enum: GovernmentLevel, required: true })
  level: GovernmentLevel;

  @Prop({ type: String, required: false })
  parentId?: string; // regionId of the parent (e.g. Cell's parent is a Sector)

  @Prop({ type: String, required: true })
  hierarchyPath: string; // e.g., "/national/eastern/nyagatare/karangazi/ndama"
}

export const RegionSchema = SchemaFactory.createForClass(Region);

RegionSchema.index({ level: 1 });
RegionSchema.index({ parentId: 1 });
RegionSchema.index({ hierarchyPath: 1 });
