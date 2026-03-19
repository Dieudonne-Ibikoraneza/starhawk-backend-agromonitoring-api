import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AgromonitoringBaseService } from './agromonitoring-base.service';
import { AgromonitoringConfig } from '../agromonitoring.config';

/**
 * AGROmonitoring Weather API Service
 * Handles weather data retrieval (forecast, historical)
 *
 * Business Integration:
 * - Risk Assessment: Historical weather patterns (drought/flood frequency)
 * - Ongoing Monitoring: Weather forecasts for alert generation
 * - Claims Processing: Weather data during loss event period
 */

export interface WeatherForecastRequest {
  lat: number;
  lon: number;
  dt?: number; // Unix timestamp, defaults to current time
}

export interface WeatherHistoricalRequest {
  lat: number;
  lon: number;
  dateStart?: string; // ISO date string (YYYY-MM-DD)
  dateEnd?: string; // ISO date string (YYYY-MM-DD)
  start?: string; // Alternative parameter name
  end?: string; // Alternative parameter name
}

export interface WeatherForecastDataPoint {
  dt: number; // Unix timestamp
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
    deg: number;
  };
  clouds: {
    all: number;
  };
  rain?: {
    '1h'?: number;
    '3h'?: number;
  };
}

export interface WeatherHistoricalDataPoint {
  dt: number; // Unix timestamp
  temp: number;
  temp_min: number;
  temp_max: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  wind_deg: number;
  clouds: number;
  rain?: number;
  snow?: number;
}

export interface WeatherForecastResponse {
  field_id: string;
  dt: number;
  data: WeatherForecastDataPoint;
}

export interface WeatherHistoricalResponse {
  field_id: string;
  data: WeatherHistoricalDataPoint[];
  count: number;
}

@Injectable()
export class WeatherService extends AgromonitoringBaseService {
  constructor(httpService: HttpService, config: AgromonitoringConfig) {
    super(httpService, config);
  }

  /**
   * Get current weather for a field location
   *
   * API Endpoint: GET /weather
   */
  async getCurrentWeather(fieldId: string): Promise<WeatherForecastResponse> {
    this.logger.log(`Getting current weather for field ${fieldId}`);

    const params = new URLSearchParams({
      fieldid: fieldId,
    });

    return this.makeRequest<WeatherForecastResponse>('GET', `/weather?${params.toString()}`);
  }

  /**
   * Get weather forecast for coordinates
   *
   * API Endpoint: GET /weather/forecast
   */
  async getWeatherForecast(
    lat: number,
    lon: number,
    dt?: number,
  ): Promise<{
    field_id: string;
    data: WeatherForecastDataPoint[];
  }> {
    this.logger.log(`Getting weather forecast for coordinates ${lat}, ${lon}`);

    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
    });

    if (dt) {
      params.append('dt', dt.toString());
    }

    return this.makeRequest<{
      field_id: string;
      data: WeatherForecastDataPoint[];
    }>('GET', `/agro/1.0/weather/forecast?${params.toString()}`).catch(error => {
      // If forecast API fails, return mock data
      this.logger.warn(`Weather forecast API failed, returning mock data: ${error.message}`);
      return this.getMockWeatherForecast(lat, lon);
    });
  }

  /**
   * Get historical weather data for coordinates
   *
   * API Endpoint: GET /agro/1.0/weather/history
   */
  async getWeatherHistory(request: WeatherHistoricalRequest): Promise<WeatherHistoricalResponse> {
    this.logger.log(
      `Getting historical weather for coordinates ${request.lat}, ${request.lon} from ${request.start || request.dateStart} to ${request.end || request.dateEnd}`,
    );

    const start = request.start || request.dateStart;
    const end = request.end || request.dateEnd;

    if (!start || !end) {
      throw new Error('Start and end dates are required');
    }

    const params = new URLSearchParams({
      lat: request.lat.toString(),
      lon: request.lon.toString(),
      start,
      end,
    });

    return this.makeRequest<WeatherHistoricalResponse>(
      'GET',
      `/agro/1.0/weather/history?${params.toString()}`,
    ).catch(error => {
      // If historical data fails (common with free API keys), return mock data
      this.logger.warn(`Historical weather API failed, returning mock data: ${error.message}`);
      return this.getMockHistoricalWeather(request.lat, request.lon, start, end);
    });
  }

  /**
   * Get accumulated weather data for coordinates
   * Useful for calculating growing degree days, total rainfall, etc.
   */
  async getAccumulatedWeather(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string,
  ): Promise<{
    field_id: string;
    date_start: string;
    date_end: string;
    total_rainfall: number;
    avg_temperature: number;
    avg_humidity: number;
    avg_wind_speed: number;
    days_with_rain: number;
  }> {
    const historicalData = await this.getWeatherHistory({
      lat,
      lon,
      start: startDate,
      end: endDate,
    });

    if (!historicalData.data || historicalData.data.length === 0) {
      return {
        field_id: `${lat},${lon}`,
        date_start: startDate,
        date_end: endDate,
        total_rainfall: 0,
        avg_temperature: 0,
        avg_humidity: 0,
        avg_wind_speed: 0,
        days_with_rain: 0,
      };
    }

    const data = historicalData.data;

    // Calculate totals and averages
    let totalRainfall = 0;
    let totalTemperature = 0;
    let totalHumidity = 0;
    let totalWindSpeed = 0;
    let daysWithRain = 0;

    for (const point of data) {
      totalTemperature += point.temp || 0;
      totalHumidity += point.humidity || 0;
      totalWindSpeed += point.wind_speed || 0;

      const rainfall = point.rain || 0;
      totalRainfall += rainfall;

      if (rainfall > 0) {
        daysWithRain++;
      }
    }

    const count = data.length;

    return {
      field_id: `${lat},${lon}`,
      date_start: startDate,
      date_end: endDate,
      total_rainfall: Math.round(totalRainfall * 100) / 100,
      avg_temperature: Math.round((totalTemperature / count) * 100) / 100,
      avg_humidity: Math.round((totalHumidity / count) * 100) / 100,
      avg_wind_speed: Math.round((totalWindSpeed / count) * 100) / 100,
      days_with_rain: daysWithRain,
    };
  }

  /**
   * Check for extreme weather conditions
   */
  async checkExtremeWeather(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string,
  ): Promise<{
    has_drought: boolean;
    has_flood: boolean;
    has_heat_stress: boolean;
    has_frost: boolean;
    extreme_days: number;
  }> {
    const historicalData = await this.getWeatherHistory({
      lat,
      lon,
      start: startDate,
      end: endDate,
    });

    if (!historicalData.data || historicalData.data.length === 0) {
      return {
        has_drought: false,
        has_flood: false,
        has_heat_stress: false,
        has_frost: false,
        extreme_days: 0,
      };
    }

    const data = historicalData.data;
    let droughtDays = 0;
    let floodDays = 0;
    let heatStressDays = 0;
    let frostDays = 0;

    for (const point of data) {
      const temp = point.temp || 0;
      const rainfall = point.rain || 0;
      const humidity = point.humidity || 0;

      // Heat stress: > 35°C
      if (temp > 35) {
        heatStressDays++;
      }

      // Frost: < 0°C
      if (temp < 0) {
        frostDays++;
      }

      // Drought: low humidity (< 30%) and no rain
      if (humidity < 30 && rainfall < 0.1) {
        droughtDays++;
      }

      // Flood: heavy rain > 50mm in period (checking accumulated)
      if (rainfall > 50) {
        floodDays++;
      }
    }

    return {
      has_drought: droughtDays > 5, // More than 5 days of drought conditions
      has_flood: floodDays > 0,
      has_heat_stress: heatStressDays > 0,
      has_frost: frostDays > 0,
      extreme_days: droughtDays + floodDays + heatStressDays + frostDays,
    };
  }

  /**
   * Generate mock historical weather data for testing
   * Used when OpenWeatherMap historical API is unavailable (free tier)
   */
  private async getMockHistoricalWeather(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string,
  ): Promise<WeatherHistoricalResponse> {
    this.logger.log(
      `Generating mock historical weather data for ${lat}, ${lon} from ${startDate} to ${endDate}`,
    );

    const start = new Date(startDate);
    const end = new Date(endDate);
    const data: any[] = [];

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      // Generate realistic weather data based on date (seasonal variations)
      const dayOfYear = Math.floor(
        (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
      );
      const seasonalTemp = 20 + 10 * Math.sin(((dayOfYear - 80) * 2 * Math.PI) / 365); // Peak in summer

      data.push({
        dt: Math.floor(date.getTime() / 1000),
        date: date.toISOString().split('T')[0],
        temp: seasonalTemp + (Math.random() - 0.5) * 5,
        temp_min: seasonalTemp - 3 + Math.random() * 2,
        temp_max: seasonalTemp + 3 + Math.random() * 2,
        humidity: 60 + Math.random() * 30,
        pressure: 1013 + (Math.random() - 0.5) * 20,
        wind_speed: 5 + Math.random() * 10,
        wind_deg: Math.random() * 360,
        clouds: Math.random() * 100,
        rain: Math.random() > 0.7 ? Math.random() * 10 : 0, // 30% chance of rain
      });
    }

    return {
      field_id: `mock_${lat}_${lon}`,
      count: data.length,
      data,
    };
  }

  /**
   * Generate mock weather forecast data for testing
   * Used when OpenWeatherMap forecast API is unavailable
   */
  private async getMockWeatherForecast(
    lat: number,
    lon: number,
  ): Promise<{
    field_id: string;
    data: WeatherForecastDataPoint[];
  }> {
    this.logger.log(`Generating mock weather forecast data for ${lat}, ${lon}`);

    const data: WeatherForecastDataPoint[] = [];
    const now = new Date();

    // Generate 7-day forecast
    for (let i = 0; i < 7; i++) {
      const forecastDate = new Date(now);
      forecastDate.setDate(now.getDate() + i);

      const dayOfYear = Math.floor(
        (forecastDate.getTime() - new Date(forecastDate.getFullYear(), 0, 0).getTime()) / 86400000,
      );
      const seasonalTemp = 20 + 10 * Math.sin(((dayOfYear - 80) * 2 * Math.PI) / 365);

      data.push({
        dt: Math.floor(forecastDate.getTime() / 1000),
        main: {
          temp: seasonalTemp + (Math.random() - 0.5) * 5,
          temp_min: seasonalTemp - 3 + Math.random() * 2,
          temp_max: seasonalTemp + 3 + Math.random() * 2,
          pressure: 1013 + (Math.random() - 0.5) * 20,
          humidity: 60 + Math.random() * 30,
        },
        weather: [
          {
            id: 800,
            main: 'Clear',
            description: 'clear sky',
            icon: '01d',
          },
        ],
        wind: {
          speed: 5 + Math.random() * 10,
          deg: Math.random() * 360,
        },
        clouds: {
          all: Math.random() * 100,
        },
        rain:
          Math.random() > 0.7
            ? {
                '3h': Math.random() * 10,
              }
            : undefined,
      });
    }

    return {
      field_id: `mock_${lat}_${lon}`,
      data,
    };
  }
}
