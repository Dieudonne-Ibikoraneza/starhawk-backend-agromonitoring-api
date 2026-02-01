import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PolicyStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export type PolicyDocument = Policy & Document;

@Schema({ timestamps: true })
export class Policy {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  farmerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Farm', required: true })
  farmId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  insurerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Assessment', required: true })
  assessmentId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  policyNumber: string;

  @Prop({ type: String })
  coverageLevel?: string;

  @Prop({ type: Number, required: true })
  premiumAmount: number;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ enum: PolicyStatus, default: PolicyStatus.ACTIVE })
  status: PolicyStatus;

  @Prop({ type: Date })
  issuedAt?: Date;
}

export const PolicySchema = SchemaFactory.createForClass(Policy);

PolicySchema.index({ farmerId: 1 });
PolicySchema.index({ farmId: 1 });
PolicySchema.index({ insurerId: 1 });
PolicySchema.index({ policyNumber: 1 });
PolicySchema.index({ status: 1 });

