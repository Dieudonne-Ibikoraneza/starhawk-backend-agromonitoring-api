import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CropMonitoringStatus } from './crop-monitoring.schema';

export type CropMonitoringCycleDocument = CropMonitoringCycle & Document;

@Schema({ timestamps: true })
export class CropMonitoringCycle {
  @Prop({ type: Types.ObjectId, ref: 'CropMonitoring', required: true })
  cropMonitoringId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  monitoringNumber: number; // Monthly cycle number until crop harvest window

  @Prop({ type: Date, default: Date.now })
  monitoringDate: Date;

  @Prop({ type: Object })
  weatherData?: object; // Weather data from EOSDA

  @Prop({ type: Object })
  ndviData?: object; // NDVI data from EOSDA

  @Prop({ type: [String] })
  observations?: string[];

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: [String], default: [] })
  photoUrls?: string[];

  @Prop({ type: Boolean, default: false })
  reportGenerated: boolean;

  @Prop({ type: Date })
  reportGeneratedAt?: Date;

  @Prop({ type: [{
    pdfType: { type: String, required: true },
    pdfUrl: { type: String, required: true },
    droneAnalysisData: { type: Object },
    uploadedAt: { type: Date, default: Date.now }
  }] })
  droneAnalysisPdfs?: {
    pdfType: string;
    pdfUrl: string;
    droneAnalysisData?: object;
    uploadedAt: Date;
  }[];

  @Prop({ enum: CropMonitoringStatus, default: CropMonitoringStatus.IN_PROGRESS })
  status: CropMonitoringStatus;
}

export const CropMonitoringCycleSchema =
  SchemaFactory.createForClass(CropMonitoringCycle);

CropMonitoringCycleSchema.index({ cropMonitoringId: 1 });
CropMonitoringCycleSchema.index({ status: 1 });
CropMonitoringCycleSchema.index({ monitoringNumber: 1 });
