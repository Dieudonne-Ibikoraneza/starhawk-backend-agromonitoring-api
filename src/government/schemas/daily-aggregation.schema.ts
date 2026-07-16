import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { GovernmentLevel } from '../../users/enums/government-level.enum';

export type DailyAggregationDocument = DailyAggregation & Document;

@Schema({ _id: false })
class AggregatedMetrics {
  @Prop({ required: true, default: 0 })
  ndvi: number;

  @Prop({ required: true, default: 0 })
  insurance: number; // Insurance Penetration (%)

  @Prop({ required: true, default: 0 })
  yield: number; // Avg Yield (t/ha)

  @Prop({ required: true, default: 0 })
  claims: number; // Active Claims

  @Prop({ required: true, default: 0 })
  subsidy: number; // Subsidy Utilized (M RWF)

  @Prop({ required: true, default: 0 })
  cultivated: number; // Cultivated Area (ha)
}

@Schema({ timestamps: true })
export class DailyAggregation {
  @Prop({ type: String, required: true })
  regionId: string;

  @Prop({ type: String, enum: GovernmentLevel, required: true })
  level: GovernmentLevel;

  @Prop({ type: String, required: true })
  date: string; // ISO format 'YYYY-MM-DD'

  @Prop({ type: String, required: true })
  season: string; // e.g., 'Season A 2026'

  @Prop({ type: AggregatedMetrics, required: true })
  metrics: AggregatedMetrics;
}

export const DailyAggregationSchema = SchemaFactory.createForClass(DailyAggregation);

// Compound index for quick querying by region, season, and date
DailyAggregationSchema.index({ regionId: 1, season: 1, date: -1 });
