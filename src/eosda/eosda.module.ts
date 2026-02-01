import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { EosdaService } from './eosda.service';
import { EosdaConfig } from './eosda.config';
import { FieldManagementService } from './services/field-management.service';
import { FieldAnalyticsService } from './services/field-analytics.service';
import { FieldImageryService } from './services/field-imagery.service';
import { WeatherService } from './services/weather.service';
import { RenderService } from './services/render.service';
// Backward compatibility
import { StatisticsService } from './services/statistics.service';
import { ImageryService } from './services/imagery.service';

@Module({
  imports: [
    ConfigModule, // Import ConfigModule to ensure ConfigService is available
    HttpModule,
  ],
  providers: [
    EosdaConfig,
    EosdaService,
    FieldManagementService,
    FieldAnalyticsService,
    FieldImageryService,
    WeatherService,
    RenderService,
    // Backward compatibility
    StatisticsService,
    ImageryService,
  ],
  exports: [EosdaService],
})
export class EosdaModule {}
