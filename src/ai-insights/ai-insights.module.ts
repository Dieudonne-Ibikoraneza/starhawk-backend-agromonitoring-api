import { Module } from '@nestjs/common';
import { AiInsightsController } from './ai-insights.controller';
import { AiInsightsService } from './ai-insights.service';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AiInsight, AiInsightSchema } from './schemas/ai-insight.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: AiInsight.name, schema: AiInsightSchema }]),
  ],
  controllers: [AiInsightsController],
  providers: [AiInsightsService],
  exports: [AiInsightsService],
})
export class AiInsightsModule {}
