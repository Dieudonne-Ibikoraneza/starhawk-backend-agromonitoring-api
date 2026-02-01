import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum AlertType {
  NDVI_DROP = 'NDVI_DROP',
  WEATHER_WARNING = 'WEATHER_WARNING',
  THRESHOLD_EXCEEDED = 'THRESHOLD_EXCEEDED',
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export type AlertDocument = Alert & Document;

@Schema({ timestamps: true })
export class Alert {
  @Prop({ type: Types.ObjectId, ref: 'Farm', required: true })
  farmId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Policy', required: true })
  policyId: Types.ObjectId;

  @Prop({ enum: AlertType, required: true })
  type: AlertType;

  @Prop({ enum: AlertSeverity, default: AlertSeverity.MEDIUM })
  severity: AlertSeverity;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: Date, default: Date.now })
  sentAt: Date;

  @Prop({ type: Date })
  readAt?: Date;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);

AlertSchema.index({ farmId: 1 });
AlertSchema.index({ policyId: 1 });
AlertSchema.index({ type: 1 });
AlertSchema.index({ sentAt: 1 });

