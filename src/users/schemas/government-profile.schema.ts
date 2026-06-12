import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { GovernmentLevel } from '../enums/government-level.enum';

export type GovernmentProfileDocument = GovernmentProfile & Document;

@Schema({ timestamps: true })
export class GovernmentProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: GovernmentLevel, required: true })
  level: GovernmentLevel;

  @Prop({ type: String, required: true })
  title: string;

  @Prop()
  department?: string;

  @Prop()
  province?: string;

  @Prop()
  district?: string;

  @Prop()
  sector?: string;

  @Prop()
  cell?: string;

  @Prop()
  village?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  parentGovernmentUserId?: Types.ObjectId;

  @Prop()
  officeEmail?: string;

  @Prop()
  officePhone?: string;

  @Prop()
  hierarchyPath?: string;
}

export const GovernmentProfileSchema =
  SchemaFactory.createForClass(GovernmentProfile);

GovernmentProfileSchema.index({ level: 1 });
GovernmentProfileSchema.index({ province: 1 });
GovernmentProfileSchema.index({ district: 1 });
GovernmentProfileSchema.index({ sector: 1 });
