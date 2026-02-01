import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AssessmentStatus } from '../enums/assessment-status.enum';

export type AssessmentDocument = Assessment & Document;

@Schema({ timestamps: true })
export class Assessment {
  @Prop({ type: Types.ObjectId, ref: 'Farm', required: true })
  farmId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  assessorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  insurerId?: Types.ObjectId; // Optional - null for admin-assigned assessments

  @Prop({ enum: AssessmentStatus, default: AssessmentStatus.ASSIGNED })
  status: AssessmentStatus;

  @Prop({ type: [String] })
  observations?: string[];

  @Prop({ type: [String] })
  photoUrls?: string[];

  @Prop({ type: Number, min: 0, max: 100 })
  riskScore?: number; // Calculated risk score

  @Prop({ type: String })
  reportText?: string;

  @Prop({ type: String })
  droneAnalysisPdfUrl?: string; // Path to uploaded drone PDF

  @Prop({ type: Object })
  droneAnalysisData?: object; // Extracted data from Python service

  @Prop({ type: String })
  comprehensiveNotes?: string; // Comprehensive assessment notes

  @Prop({ type: Object })
  weatherData?: object; // Weather data from EOSDA

  @Prop({ type: Boolean, default: false })
  reportGenerated?: boolean; // Flag indicating report is generated

  @Prop({ type: Date })
  reportGeneratedAt?: Date; // Timestamp when report was generated

  @Prop({ type: Date })
  assignedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  submittedAt?: Date;
}

export const AssessmentSchema = SchemaFactory.createForClass(Assessment);

AssessmentSchema.index({ farmId: 1 });
AssessmentSchema.index({ assessorId: 1 });
AssessmentSchema.index({ insurerId: 1 });
AssessmentSchema.index({ status: 1 });

