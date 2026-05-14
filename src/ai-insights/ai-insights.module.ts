import { Module } from '@nestjs/common';
import { AiInsightsController } from './ai-insights.controller';
import { AiInsightsService } from './ai-insights.service';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AiInsight, AiInsightSchema } from './schemas/ai-insight.schema';
import { Claim, ClaimSchema } from '../claims/schemas/claim.schema';
import { Farm, FarmSchema } from '../farms/schemas/farm.schema';
import { Policy, PolicySchema } from '../policies/schemas/policy.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: AiInsight.name, schema: AiInsightSchema },
      { name: Claim.name, schema: ClaimSchema },
      { name: Farm.name, schema: FarmSchema },
      { name: Policy.name, schema: PolicySchema },
    ]),
  ],
  controllers: [AiInsightsController],
  providers: [AiInsightsService],
  exports: [AiInsightsService],
})
export class AiInsightsModule {}
