import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ClaimStatus } from '../enums/claim-status.enum';
import { LossEventType } from '../enums/loss-event-type.enum';

export type ClaimDocument = Claim & Document;

@Schema({ timestamps: true })
export class Claim {
  @Prop({ type: Types.ObjectId, ref: 'Policy', required: true })
  policyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  farmerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Farm', required: true })
  farmId: Types.ObjectId;

  @Prop({ enum: ClaimStatus, default: ClaimStatus.FILED })
  status: ClaimStatus;

  @Prop({ enum: LossEventType, required: true })
  lossEventType: LossEventType;

  @Prop({ type: String })
  lossDescription?: string;

  @Prop({ type: [String] })
  damagePhotos?: string[];

  @Prop({ type: Date, default: Date.now })
  filedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assessorId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ClaimAssessment' })
  assessmentReportId?: Types.ObjectId;

  @Prop({ type: Number })
  payoutAmount?: number;

  @Prop({ type: Date })
  decisionDate?: Date;

  @Prop({ type: String })
  rejectionReason?: string;
}

export const ClaimSchema = SchemaFactory.createForClass(Claim);

ClaimSchema.index({ policyId: 1 });
ClaimSchema.index({ farmerId: 1 });
ClaimSchema.index({ farmId: 1 });
ClaimSchema.index({ status: 1 });
ClaimSchema.index({ assessorId: 1 });

