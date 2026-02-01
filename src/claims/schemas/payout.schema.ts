import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PayoutStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type PayoutDocument = Payout & Document;

@Schema({ timestamps: true })
export class Payout {
  @Prop({ type: Types.ObjectId, ref: 'Claim', required: true })
  claimId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ enum: PayoutStatus, default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Prop({ type: Date })
  processedAt?: Date;

  @Prop({ type: String })
  rejectionReason?: string;

  @Prop({ type: String })
  transactionId?: string; // Mocked transaction ID
}

export const PayoutSchema = SchemaFactory.createForClass(Payout);

PayoutSchema.index({ claimId: 1 });
PayoutSchema.index({ status: 1 });

