import { Injectable } from '@nestjs/common';
import { FieldManagementService } from './services/field-management.service';
import { FieldAnalyticsService } from './services/field-analytics.service';
import { WeatherService } from './services/weather.service';

/**
 * AGROmonitoring Service - Main service aggregating all AGROmonitoring API services
 *
 * This service provides access to:
 * - Field Management: Create/update/delete fields
 * - Field Analytics: Vegetation indices, NDVI time series
 * - Weather: Current, historical, and forecast weather data
 *
 * Replaces the previous EOSDA service with equivalent functionality
 */
@Injectable()
export class AgromonitoringService {
  constructor(
    public readonly fieldManagement: FieldManagementService,
    public readonly fieldAnalytics: FieldAnalyticsService,
    public readonly weather: WeatherService,
  ) {}

  // Alias methods for backward compatibility with old EOSDA API

  // Statistics aliases
  async getStatistics(fieldId: string, startDate: string, endDate: string) {
    return this.fieldAnalytics.getFieldStatistics(fieldId, startDate, endDate);
  }

  async getNDVITimeSeries(fieldId: string, startDate: string, endDate: string) {
    return this.fieldAnalytics.getNDVIData({ fieldId, start: startDate, end: endDate });
  }

  // Field analytics alias
  async getFieldTrend(
    fieldId: string,
    startDate: string,
    endDate: string,
    index?: string,
    dataSource?: string,
  ) {
    return this.fieldAnalytics.getNDVIData({ fieldId, start: startDate, end: endDate });
  }

  // Weather aliases
  async getForecast(lat: number, lon: number, dateStart?: string, dateEnd?: string) {
    return this.weather.getWeatherForecast(lat, lon);
  }

  async getHistoricalWeather(lat: number, lon: number, dateStart: string, dateEnd: string) {
    return this.weather.getWeatherHistory({ lat, lon, dateStart, dateEnd });
  }

  async getHistoricalAccumulated(
    lat: number,
    lon: number,
    dateStart: string,
    dateEnd: string,
    sumOfActiveTemperatures?: number,
    provider?: string,
  ) {
    return this.weather.getAccumulatedWeather(lat, lon, dateStart, dateEnd);
  }
}
