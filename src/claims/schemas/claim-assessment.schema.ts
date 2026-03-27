import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({ type: Number, required: false })
  @Prop({ type: Number })
  ndviBefore?: number;

  @ApiProperty({ type: Number, required: false })
  @Prop({ type: Number })
  ndviAfter?: number;

  @ApiProperty({ type: String, required: false })
  @Prop({ type: String })
  weatherImpactAnalysis?: string;

  @ApiProperty({ type: String, required: false })
  @Prop({ type: String })
  reportText?: string;

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

  @Prop({ type: Date })
  submittedAt?: Date;
}

export const ClaimAssessmentSchema =
  SchemaFactory.createForClass(ClaimAssessment);

ClaimAssessmentSchema.index({ claimId: 1 });
ClaimAssessmentSchema.index({ assessorId: 1 });

