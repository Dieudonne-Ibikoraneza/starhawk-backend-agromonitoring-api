import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MonitoringRecordDocument = MonitoringRecord & Document;

@Schema({ timestamps: true })
export class MonitoringRecord {
  @Prop({ type: Types.ObjectId, ref: 'Farm', required: true })
  farmId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Policy', required: true })
  policyId: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  monitoredAt: Date;

  @Prop({ type: Number })
  currentNdvi?: number;

  @Prop({ type: Number })
  ndviTrend?: number; // -1 = declining, 0 = stable, 1 = improving

  @Prop({ type: [String] })
  weatherAlerts?: string[];

  @Prop({ type: Boolean, default: false })
  thresholdsExceeded: boolean;

  @Prop({ type: Boolean, default: false })
  alertSent: boolean;
}

export const MonitoringRecordSchema =
  SchemaFactory.createForClass(MonitoringRecord);

MonitoringRecordSchema.index({ farmId: 1 });
MonitoringRecordSchema.index({ policyId: 1 });
MonitoringRecordSchema.index({ monitoredAt: 1 });

