import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EosdaBaseService } from './eosda-base.service';
import { EosdaConfig } from '../eosda.config';

/**
 * EOSDA Weather API Service
 * Handles weather data retrieval (forecast, historical)
 * 
 * Business Integration:
 * - Risk Assessment: Historical weather patterns (drought/flood frequency)
 * - Ongoing Monitoring: Weather forecasts for alert generation
 * - Claims Processing: Weather data during loss event period
 */

export interface WeatherForecastRequest {
  fieldId: string;
  dateStart: string; // ISO date string (YYYY-MM-DD) - Must be today or future
  dateEnd: string; // ISO date string (YYYY-MM-DD) - Max 14 days ahead
}

export interface WeatherHistoricalRequest {
  fieldId: string;
  dateStart: string; // ISO date string (YYYY-MM-DD)
  dateEnd: string; // ISO date string (YYYY-MM-DD)
}

export interface WeatherAccumulatedRequest {
  fieldId: string;
  dateStart: string; // ISO date string (YYYY-MM-DD)
  dateEnd: string; // ISO date string (YYYY-MM-DD)
  sumOfActiveTemperatures?: number; // Base temperature for GDD (default: 10)
  provider?: string; // Weather provider (default: 'weather-online')
}

export interface WeatherForecastDataPoint {
  date: string; // ISO date string
  time: string; // Time (HH:mm:ss)
  temperature: number; // Celsius
  temperature_min: number; // Celsius
  temperature_max: number; // Celsius
  rainfall: number; // mm
  humidity: number; // Percentage (0-100)
  wind_speed: number; // km/h
  wind_direction: number; // Degrees (0-360)
  cloudiness: number; // Percentage (0-100)
  pressure: number; // hPa
}

export interface WeatherHistoricalDataPoint {
  date: string; // ISO date string
  rainfall: number; // mm
  temp_critical: number; // Days with critical temperature
  temperature_min: number; // Celsius
  temperature_max: number; // Celsius
}

export interface WeatherAccumulatedData {
  date_start: string;
  date_end: string;
  total_rainfall: number; // mm
  total_active_temperatures: number; // Growing Degree Days (GDD)
  average_temperature: number; // Celsius
  frost_days: number;
  heat_stress_days: number; // Days > 35°C
}

export interface WeatherForecastResponse {
  field_id: string;
  forecast: WeatherForecastDataPoint[];
}

export interface WeatherHistoricalResponse {
  field_id: string;
  historical_data: WeatherHistoricalDataPoint[];
  statistics: {
    total_rainfall_mm: number;
    avg_temperature: number;
    days_with_rainfall: number;
    days_with_critical_temp: number;
  };
}

export interface WeatherAccumulatedResponse {
  field_id: string;
  accumulated_data: WeatherAccumulatedData;
  monthly_breakdown?: Array<{
    month: string; // YYYY-MM
    rainfall: number;
    active_temperatures: number;
    avg_temp: number;
  }>;
}

// Legacy interfaces for backward compatibility
export interface WeatherRequest {
  geometry: {
    type: 'Point' | 'Polygon';
    coordinates: number[] | number[][][];
  };
  startDate?: string;
  endDate?: string;
}

export interface WeatherDataPoint {
  date: string;
  temperature: {
    min: number;
    max: number;
    average: number;
  };
  rainfall: number;
  humidity?: number;
  windSpeed?: number;
  windDirection?: number;
  pressure?: number;
  evapotranspiration?: number;
}

export interface WeatherResponse {
  location: {
    type: string;
    coordinates: number[];
    centroid?: number[];
  };
  data: WeatherDataPoint[];
  period: {
    start: string;
    end: string;
  };
  metadata?: {
    dataSource: string;
    resolution?: string;
  };
}

export interface WeatherForecastRequestLegacy {
  geometry: {
    type: 'Point' | 'Polygon';
    coordinates: number[] | number[][][];
  };
  days?: number;
}

export interface WeatherAlert {
  type: 'drought' | 'flood' | 'extreme_temperature' | 'storm' | 'frost';
  severity: 'low' | 'medium' | 'high' | 'extreme';
  date: string;
  description: string;
}

@Injectable()
export class WeatherService extends EosdaBaseService {
  constructor(httpService: HttpService, config: EosdaConfig) {
    super(httpService, config);
  }

  /**
   * Get weather forecast (high accuracy)
   * Endpoint: POST /weather/forecast-high-accuracy/{field_id}
   * Response: Immediate (sync)
   * 
   * @param request Forecast request with fieldId and date range (max 14 days)
   * @returns Weather forecast data (3-hour intervals)
   */
  async getForecast(
    request: WeatherForecastRequest,
  ): Promise<WeatherForecastResponse> {
    const params = {
      date_start: request.dateStart,
      date_end: request.dateEnd,
    };

    return this.makeRequest<WeatherForecastResponse>(
      'POST',
      `/weather/forecast-high-accuracy/${request.fieldId}`,
      { params },
    );
  }

  /**
   * Get historical weather data (high accuracy)
   * Endpoint: POST /weather/historical-high-accuracy/{field_id}
   * Response: Immediate (sync)
   * 
   * @param request Historical request with fieldId and date range
   * @returns Historical weather data (daily)
   */
  async getHistoricalWeather(
    request: WeatherHistoricalRequest,
  ): Promise<WeatherHistoricalResponse> {
    const params = {
      date_start: request.dateStart,
      date_end: request.dateEnd,
    };

    return this.makeRequest<WeatherHistoricalResponse>(
      'POST',
      `/weather/historical-high-accuracy/${request.fieldId}`,
      { params },
    );
  }

  /**
   * Get historical accumulated weather data
   * Endpoint: POST /weather/historical-accumulated/{field_id}
   * Response: Immediate (sync)
   * 
   * Used for: Growing Degree Days (GDD), seasonal analysis
   * 
   * @param request Accumulated request with fieldId, date range, and GDD base temp
   * @returns Accumulated weather statistics
   */
  async getHistoricalAccumulated(
    request: WeatherAccumulatedRequest,
  ): Promise<WeatherAccumulatedResponse> {
    const params = {
      date_start: request.dateStart,
      date_end: request.dateEnd,
      sum_of_active_temperatures:
        request.sumOfActiveTemperatures || 10, // Default base temp for GDD
    };

    const payload: any = {
      params,
    };

    if (request.provider) {
      payload.provider = request.provider;
    }

    return this.makeRequest<WeatherAccumulatedResponse>(
      'POST',
      `/weather/historical-accumulated/${request.fieldId}`,
      payload,
    );
  }

  /**
   * @deprecated Use getForecast instead (requires fieldId from field management)
   */
  async getCurrentWeather(
    geometry: WeatherRequest['geometry'],
  ): Promise<WeatherResponse> {
    throw new Error(
      'getCurrentWeather is deprecated. Use getForecast with fieldId instead. First create a field using FieldManagementService.',
    );
  }

  /**
   * @deprecated Use getHistoricalWeather instead (requires fieldId)
   */
  async getHistoricalWeatherLegacy(
    request: WeatherRequest,
  ): Promise<WeatherResponse> {
    throw new Error(
      'getHistoricalWeatherLegacy is deprecated. Use getHistoricalWeather with fieldId instead. First create a field using FieldManagementService.',
    );
  }

  /**
   * @deprecated Use getForecast instead (requires fieldId)
   */
  async getWeatherForecast(
    request: WeatherForecastRequestLegacy,
  ): Promise<WeatherResponse> {
    throw new Error(
      'getWeatherForecast is deprecated. Use getForecast with fieldId instead. First create a field using FieldManagementService.',
    );
  }

  /**
   * Analyze weather patterns for risk assessment
   * Helper method that calculates drought/flood frequency
   * Used in: Risk scoring algorithm
   */
  analyzeWeatherRisk(
    weatherData: WeatherHistoricalDataPoint[],
  ): {
    droughtFrequency: number; // 0-1
    floodFrequency: number; // 0-1
    extremeTemperatureFrequency: number; // 0-1
    riskScore: number; // 0-100
  } {
    if (!weatherData || weatherData.length === 0) {
      return {
        droughtFrequency: 0,
        floodFrequency: 0,
        extremeTemperatureFrequency: 0,
        riskScore: 50, // Default medium risk
      };
    }

    let droughtCount = 0;
    let floodCount = 0;
    let extremeTempCount = 0;

    weatherData.forEach((data) => {
      // Drought: low rainfall (< 50mm) for extended periods
      if (data.rainfall < 50) {
        droughtCount++;
      }

      // Flood: high rainfall (> 200mm) in short period
      if (data.rainfall > 200) {
        floodCount++;
      }

      // Extreme temperatures
      if (
        data.temperature_max > 35 ||
        data.temperature_min < 5
      ) {
        extremeTempCount++;
      }
    });

    const total = weatherData.length;
    const droughtFrequency = droughtCount / total;
    const floodFrequency = floodCount / total;
    const extremeTemperatureFrequency = extremeTempCount / total;

    // Calculate overall risk score (0-100)
    const riskScore = Math.min(
      100,
      droughtFrequency * 35 +
        floodFrequency * 30 +
        extremeTemperatureFrequency * 25 +
        10, // Base risk
    );

    return {
      droughtFrequency,
      floodFrequency,
      extremeTemperatureFrequency,
      riskScore: Math.round(riskScore),
    };
  }

  /**
   * Generate weather alerts from forecast
   * Used in: Monitoring service for alert generation
   */
  generateWeatherAlerts(
    forecast: WeatherForecastResponse,
  ): WeatherAlert[] {
    const alerts: WeatherAlert[] = [];

    forecast.forecast.forEach((data) => {
      // Drought alert
      if (
        data.rainfall < 10 &&
        data.humidity &&
        data.humidity < 40
      ) {
        alerts.push({
          type: 'drought',
          severity: data.rainfall < 5 ? 'high' : 'medium',
          date: data.date,
          description: `Low rainfall (${data.rainfall}mm) with low humidity (${data.humidity}%)`,
        });
      }

      // Flood alert
      if (data.rainfall > 100) {
        alerts.push({
          type: 'flood',
          severity:
            data.rainfall > 200
              ? 'extreme'
              : data.rainfall > 150
                ? 'high'
                : 'medium',
          date: data.date,
          description: `Heavy rainfall expected: ${data.rainfall}mm`,
        });
      }

      // Extreme temperature alert
      if (
        data.temperature_max > 35 ||
        data.temperature_min < 5
      ) {
        alerts.push({
          type: 'extreme_temperature',
          severity:
            data.temperature_max > 40 || data.temperature_min < 0
              ? 'high'
              : 'medium',
          date: data.date,
          description: `Extreme temperature: Max ${data.temperature_max}°C, Min ${data.temperature_min}°C`,
        });
      }
    });

    return alerts;
  }
}
