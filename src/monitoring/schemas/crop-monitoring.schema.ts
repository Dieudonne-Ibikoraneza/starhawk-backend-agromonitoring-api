import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum CropMonitoringStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export type CropMonitoringDocument = CropMonitoring & Document;

@Schema({ timestamps: true })
export class CropMonitoring {
  @Prop({ type: Types.ObjectId, ref: 'Policy', required: true })
  policyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Farm', required: true })
  farmId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  assessorId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 2 })
  monitoringNumber: number; // 1 or 2, max 2 cycles per policy

  @Prop({ type: Date, default: Date.now })
  monitoringDate: Date;

  @Prop({ type: Object })
  weatherData?: object; // Weather data from EOSDA

  @Prop({ type: Object })
  ndviData?: object; // NDVI data from EOSDA

  @Prop({ type: [String] })
  observations?: string[];

  @Prop({ type: [String] })
  photoUrls?: string[];

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Boolean, default: false })
  reportGenerated: boolean;

  @Prop({ type: Date })
  reportGeneratedAt?: Date;

  @Prop({ enum: CropMonitoringStatus, default: CropMonitoringStatus.IN_PROGRESS })
  status: CropMonitoringStatus;
}

export const CropMonitoringSchema =
  SchemaFactory.createForClass(CropMonitoring);

CropMonitoringSchema.index({ policyId: 1 });
CropMonitoringSchema.index({ farmId: 1 });
CropMonitoringSchema.index({ assessorId: 1 });
CropMonitoringSchema.index({ status: 1 });

