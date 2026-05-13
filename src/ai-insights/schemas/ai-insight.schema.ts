import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AiInsightDocument = AiInsight & Document;

@Schema({ timestamps: true })
export class AiInsight {
  @Prop({ type: String, enum: ['FARMER', 'ASSESSOR', 'INSURER'], required: true })
  role: string;

  @Prop({ type: String, enum: ['SUGGESTIONS', 'RISK_ANALYSIS', 'MONITORING_CYCLE'], required: true })
  type: string;

  @Prop({ type: Types.ObjectId, refPath: 'contextModel', required: true })
  contextId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['Claim', 'Farm'] })
  contextModel: string;

  @Prop({ type: Object, required: true })
  data: any; // The initial structured analysis (riskLevel, summary, etc.)

  @Prop({ type: [{
    role: { type: String, enum: ['user', 'model'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }], default: [] })
  conversation: {
    role: 'user' | 'model';
    content: string;
    timestamp: Date;
  }[];

  @Prop({ type: Date, default: Date.now })
  lastAccessed: Date;
}

export const AiInsightSchema = SchemaFactory.createForClass(AiInsight);

AiInsightSchema.index({ contextId: 1, role: 1, type: 1 }, { unique: true });
