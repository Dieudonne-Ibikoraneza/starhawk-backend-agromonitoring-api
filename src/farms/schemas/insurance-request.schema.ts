import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InsuranceRequestStatus } from '../enums/insurance-request-status.enum';

export type InsuranceRequestDocument = InsuranceRequest & Document;

@Schema({ timestamps: true })
export class InsuranceRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  farmerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Farm', required: true })
  farmId: Types.ObjectId;

  @Prop({ enum: InsuranceRequestStatus, default: InsuranceRequestStatus.PENDING })
  status: InsuranceRequestStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  insurerId?: Types.ObjectId; // Assigned insurer

  @Prop({ type: Date })
  requestedAt: Date;

  @Prop()
  notes?: string;
}

export const InsuranceRequestSchema =
  SchemaFactory.createForClass(InsuranceRequest);

InsuranceRequestSchema.index({ farmerId: 1 });
InsuranceRequestSchema.index({ farmId: 1 });
InsuranceRequestSchema.index({ status: 1 });
InsuranceRequestSchema.index({ insurerId: 1 });

