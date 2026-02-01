import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { FarmStatus } from '../enums/farm-status.enum';
import { CropType } from '../enums/crop-type.enum';

export type FarmDocument = Farm & Document;

@Schema({ timestamps: true })
export class Farm {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  farmerId: Types.ObjectId;

  @Prop()
  name?: string; // Provided by assessor when uploading KML

  @Prop({ type: Number })
  area?: number; // in hectares, calculated from geometry

  @Prop({ enum: CropType, required: true })
  cropType: CropType;

  @Prop({ type: Date, required: true })
  sowingDate: Date;

  @Prop({
    type: {
      type: String,
      enum: ['Point', 'Polygon', 'MultiPolygon'],
    },
    coordinates: { type: Array },
  })
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude] for centroid
  };

  @Prop({
    type: {
      type: String,
      enum: ['Polygon', 'MultiPolygon'],
    },
    coordinates: { type: Array },
  })
  boundary?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };

  @Prop({ enum: FarmStatus, default: FarmStatus.PENDING })
  status: FarmStatus;

  @Prop()
  shapefilePath?: string;

  @Prop()
  eosdaFieldId?: string; // Will be populated after EOSDA integration
}

export const FarmSchema = SchemaFactory.createForClass(Farm);

// Indexes for geospatial queries
FarmSchema.index({ location: '2dsphere' });
FarmSchema.index({ boundary: '2dsphere' });
FarmSchema.index({ farmerId: 1 });
FarmSchema.index({ status: 1 });

