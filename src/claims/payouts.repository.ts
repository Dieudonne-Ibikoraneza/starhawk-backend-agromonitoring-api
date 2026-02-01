import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payout, PayoutDocument } from './schemas/payout.schema';

@Injectable()
export class PayoutsRepository {
  constructor(
    @InjectModel(Payout.name) private payoutModel: Model<PayoutDocument>,
  ) {}

  async create(payoutData: Partial<Payout>): Promise<PayoutDocument> {
    const payout = new this.payoutModel(payoutData);
    return payout.save();
  }

  async findByClaimId(claimId: string): Promise<PayoutDocument | null> {
    return this.payoutModel.findOne({ claimId }).exec();
  }

  async update(
    id: string,
    updateData: Partial<Payout>,
  ): Promise<PayoutDocument | null> {
    return this.payoutModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }
}

