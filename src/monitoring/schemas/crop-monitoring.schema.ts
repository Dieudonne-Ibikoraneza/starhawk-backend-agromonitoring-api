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

  @Prop({ enum: CropMonitoringStatus, default: CropMonitoringStatus.IN_PROGRESS })
  status: CropMonitoringStatus;
}

export const CropMonitoringSchema =
  SchemaFactory.createForClass(CropMonitoring);

CropMonitoringSchema.index({ policyId: 1 });
CropMonitoringSchema.index({ farmId: 1 });
CropMonitoringSchema.index({ assessorId: 1 });
CropMonitoringSchema.index({ status: 1 });

