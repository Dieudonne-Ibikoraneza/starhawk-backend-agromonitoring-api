import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health.controller';
import { MongooseHealthIndicator } from './mongoose-health.indicator';

@Module({
  imports: [TerminusModule, MongooseModule],
  controllers: [HealthController],
  providers: [MongooseHealthIndicator],
})
export class HealthModule {}

