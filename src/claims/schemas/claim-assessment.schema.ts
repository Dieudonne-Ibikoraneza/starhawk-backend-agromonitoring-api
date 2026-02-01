import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClaimAssessmentDocument = ClaimAssessment & Document;

@Schema({ timestamps: true })
export class ClaimAssessment {
  @Prop({ type: Types.ObjectId, ref: 'Claim', required: true })
  claimId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  assessorId: Types.ObjectId;

  @Prop({ type: Date })
  visitDate?: Date;

  @Prop({ type: [String] })
  observations?: string[];

  @Prop({ type: [String] })
  photos?: string[];

  @Prop({ type: Number })
  damageArea?: number; // in hectares

  @Prop({ type: Number })
  ndviBefore?: number;

  @Prop({ type: Number })
  ndviAfter?: number;

  @Prop({ type: String })
  weatherImpactAnalysis?: string;

  @Prop({ type: String })
  reportText?: string;

  @Prop({ type: Date })
  submittedAt?: Date;
}

export const ClaimAssessmentSchema =
  SchemaFactory.createForClass(ClaimAssessment);

ClaimAssessmentSchema.index({ claimId: 1 });
ClaimAssessmentSchema.index({ assessorId: 1 });

