import { Injectable } from '@nestjs/common';
import { FieldManagementService } from './services/field-management.service';
import { FieldAnalyticsService } from './services/field-analytics.service';
import { FieldImageryService } from './services/field-imagery.service';
import { WeatherService } from './services/weather.service';
import { RenderService } from './services/render.service';
// Backward compatibility - keep old service names
import { StatisticsService } from './services/statistics.service';
import { ImageryService } from './services/imagery.service';

/**
 * EOSDA Service - Main service aggregating all EOSDA API services
 * 
 * This service provides access to:
 * - Field Management: Create/update/delete fields in EOSDA
 * - Field Analytics: Vegetation indices, NDVI time series, statistics
 * - Field Imagery: Satellite imagery search and retrieval
 * - Weather: Current, historical, and forecast weather data
 * - Render: Map rendering and NDVI visualization
 * 
 * Backward compatibility: statistics and imagery services are aliased
 * for existing code, but new code should use fieldAnalytics and fieldImagery
 */
@Injectable()
export class EosdaService {
  constructor(
    public readonly fieldManagement: FieldManagementService,
    public readonly fieldAnalytics: FieldAnalyticsService,
    public readonly fieldImagery: FieldImageryService,
    public readonly weather: WeatherService,
    public readonly render: RenderService,
    // Backward compatibility aliases
    public readonly statistics: StatisticsService,
    public readonly imagery: ImageryService,
  ) {}
}
