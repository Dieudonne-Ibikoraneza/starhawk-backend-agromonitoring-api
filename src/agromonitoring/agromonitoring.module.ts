import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AgromonitoringService } from './agromonitoring.service';
import { AgromonitoringConfig } from './agromonitoring.config';
import { FieldManagementService } from './services/field-management.service';
import { FieldAnalyticsService } from './services/field-analytics.service';
import { WeatherService } from './services/weather.service';

@Module({
  imports: [
    ConfigModule, // Import ConfigModule to ensure ConfigService is available
    HttpModule,
  ],
  providers: [
    AgromonitoringConfig,
    AgromonitoringService,
    FieldManagementService,
    FieldAnalyticsService,
    WeatherService,
  ],
  exports: [AgromonitoringService],
})
export class AgromonitoringModule {}
