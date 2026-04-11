import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AgromonitoringBaseService } from './agromonitoring-base.service';
import { AgromonitoringConfig } from '../agromonitoring.config';

/**
 * AGROmonitoring Field Analytics API Service
 * Handles vegetation indices, NDVI time series, and field statistics
 * 
 * Business Integration:
 * - Risk Assessment: Historical NDVI trends for risk scoring
 * - Claims Processing: NDVI before/after comparison for damage analysis
 * - Ongoing Monitoring: Current NDVI for alert generation
 */

export interface NDVIDataRequest {
  fieldId: string;
  start?: string; // ISO date string (YYYY-MM-DD)
  end?: string; // ISO date string (YYYY-MM-DD)
  startDate?: string; // Alternative parameter name
  endDate?: string; // Alternative parameter name
  index?: string; // Index type (NDVI, EVI, etc.)
  dataSource?: string; // Satellite source (S2, L8)
}

// Backward compatibility interface for EOSDA calls
export interface StatisticsRequest {
  fieldId?: string;
  geometry?: any;
  startDate?: string;
  endDate?: string;
}

export interface NDVIDataPoint {
  date: string;
  ndvi: number;
  ndvi_quality?: number;
}

export interface NDVITimeSeriesResponse {
  field_id: string;
  date: string;
  ndvi: number;
  ndvi_quality?: number;
  // Add indices property for compatibility
  indices?: {
    NDVI?: Array<{ date: string; value: number }>;
  };
}

/**
 * Soil temperature and moisture data
 */
export interface SoilDataRequest {
  fieldId: string;
  start: string;
  end: string;
}

export interface SoilDataPoint {
  date: string;
  temperature: number; // Celsius
  moisture: number; // Percentage
}

export interface SoilDataResponse {
  field_id: string;
  data: SoilDataPoint[];
}

/**
 * Weather data for field
 */
export interface WeatherDataRequest {
  fieldId: string;
  start: string;
  end: string;
}

export interface WeatherDataPoint {
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
}

export interface WeatherDataResponse {
  field_id: string;
  data: WeatherDataPoint[];
}

/**
 * Satellite imagery metadata
 */
export interface ImagerySearchRequest {
  fieldId: string;
  start: string;
  end: string;
  clouds?: number; // Max cloud coverage percentage
}

export interface ImageryMetadata {
  id: string;
  date: string;
  cloud_coverage: number;
  satellite: string; // 'L8' for Landsat 8, 'S2' for Sentinel-2
  preview_url?: string;
}

export interface ImagerySearchResponse {
  field_id: string;
  results: ImageryMetadata[];
}

@Injectable()
export class FieldAnalyticsService extends AgromonitoringBaseService {
  constructor(httpService: HttpService, config: AgromonitoringConfig) {
    super(httpService, config);
  }

  /**
   * Get NDVI time series for a field (polygon created via /agro/1.0/polygons).
   *
   * API: GET /agro/1.0/ndvi/history?polyid=...&start=UNIX&end=UNIX
   * (see https://agromonitoring.com/api/history-ndvi)
   */
  async getNDVIData(request: NDVIDataRequest): Promise<NDVITimeSeriesResponse[]> {
    const start = request.start || request.startDate;
    const end = request.end || request.endDate;
    this.logger.log(
      `Getting NDVI history for polygon ${request.fieldId} from ${start} to ${end}`,
    );

    if (!start || !end) {
      throw new Error('Start and end dates are required');
    }

    const { startSec, endSec } = this.toUnixRange(start, end);
    const params = new URLSearchParams({
      polyid: request.fieldId,
      start: String(startSec),
      end: String(endSec),
    });

    const raw = await this.makeRequest<unknown>(
      'GET',
      `/agro/1.0/ndvi/history?${params.toString()}`,
    );

    return this.normalizeNdviHistoryResponse(raw, request.fieldId);
  }

  private toUnixRange(start: string, end: string): { startSec: number; endSec: number } {
    const parseOne = (s: string, edge: 'start' | 'end'): number => {
      const t = s.trim();
      if (/^\d{10}$/.test(t)) {
        return parseInt(t, 10);
      }
      if (/^\d{13}$/.test(t)) {
        return Math.floor(parseInt(t, 10) / 1000);
      }
      const iso = t.includes('T') ? t : `${t}T${edge === 'start' ? '00:00:00' : '23:59:59'}Z`;
      const ms = Date.parse(iso);
      if (Number.isNaN(ms)) {
        throw new Error(`Invalid date: ${s}`);
      }
      return Math.floor(ms / 1000);
    };
    return { startSec: parseOne(start, 'start'), endSec: parseOne(end, 'end') };
  }

  private extractNdviHistoryArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) {
      return raw;
    }
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      if (Array.isArray(o.data)) {
        return o.data;
      }
      if (Array.isArray(o.history)) {
        return o.history;
      }
    }
    return [];
  }

  /** Map Agro NDVI history entries to a stable per-day series (mean NDVI 0–1). */
  private normalizeNdviHistoryResponse(raw: unknown, fieldId: string): NDVITimeSeriesResponse[] {
    const arr = this.extractNdviHistoryArray(raw);
    const byDay = new Map<string, { sum: number; n: number }>();

    for (const item of arr) {
      if (item == null || typeof item !== 'object') {
        continue;
      }
      const o = item as Record<string, unknown>;
      const dt = o.dt;
      let dateStr = '';
      if (typeof dt === 'number') {
        dateStr = new Date(dt * 1000).toISOString().split('T')[0];
      } else if (typeof dt === 'string') {
        dateStr = dt.includes('T') ? dt.split('T')[0] : dt;
      }
      if (!dateStr) {
        continue;
      }

      const dataObj = o.data as Record<string, unknown> | undefined;
      const meanRaw = dataObj?.mean ?? o.mean ?? o.ndvi;
      const mean =
        typeof meanRaw === 'number' ? meanRaw : parseFloat(String(meanRaw ?? ''));
      if (!Number.isFinite(mean)) {
        continue;
      }

      const prev = byDay.get(dateStr);
      if (prev) {
        prev.sum += mean;
        prev.n += 1;
      } else {
        byDay.set(dateStr, { sum: mean, n: 1 });
      }
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, n }]) => ({
        field_id: fieldId,
        date,
        ndvi: sum / n,
      }));
  }

  /**
   * Get current NDVI value for a field
   */
  async getCurrentNDVI(fieldId: string): Promise<NDVITimeSeriesResponse> {
    // Get last 7 days of data and return most recent
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const data = await this.getNDVIData({
      fieldId,
      start: weekAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    });

    if (data.length === 0) {
      throw new Error('No NDVI data available for this field');
    }

    // Return most recent data point
    return data[data.length - 1];
  }

  /**
   * Get soil data (temperature and moisture) for a field
   * 
   * API Endpoint: GET /soil/{fieldId}
   */
  async getSoilData(request: SoilDataRequest): Promise<SoilDataResponse> {
    this.logger.log(`Getting soil data for field ${request.fieldId}`);
    
    const params = new URLSearchParams({
      start: request.start,
      end: request.end,
    });

    return this.makeRequest<SoilDataResponse>(
      'GET',
      `/soil/${request.fieldId}?${params.toString()}`,
    );
  }

  /**
   * Get weather data for a field
   * 
   * API Endpoint: GET /weather/{fieldId}
   */
  async getWeatherData(request: WeatherDataRequest): Promise<WeatherDataResponse> {
    this.logger.log(`Getting weather data for field ${request.fieldId}`);
    
    const params = new URLSearchParams({
      start: request.start,
      end: request.end,
    });

    return this.makeRequest<WeatherDataResponse>(
      'GET',
      `/weather/${request.fieldId}?${params.toString()}`,
    );
  }

  /**
   * Get field statistics (alias for getNDVIData for backward compatibility)
   *
   * Uses GET /agro/1.0/ndvi/history (requires polygon id from create polygon API).
   */
  async getStatistics(request: StatisticsRequest): Promise<NDVITimeSeriesResponse[]> {
    if (request.fieldId) {
      return this.getNDVIData({
        fieldId: request.fieldId,
        start: request.startDate || '',
        end: request.endDate || '',
      });
    }
    // If no fieldId, return empty array (geometry-based not supported in AGROmonitoring)
    return [];
  }

  /**
   * Get NDVI time series (alias for getNDVIData for backward compatibility)
   */
  async getNDVITimeSeries(request: StatisticsRequest): Promise<NDVITimeSeriesResponse[]> {
    if (request.fieldId) {
      return this.getNDVIData({
        fieldId: request.fieldId,
        start: request.startDate || '',
        end: request.endDate || '',
      });
    }
    return [];
  }

  /**
   * Search for available satellite imagery
   * 
   * API Endpoint: GET /image/search
   */
  async searchImagery(request: ImagerySearchRequest): Promise<ImagerySearchResponse> {
    this.logger.log(`Searching imagery for field ${request.fieldId}`);
    
    const params = new URLSearchParams({
      fieldid: request.fieldId,
      start: request.start,
      end: request.end,
    });

    if (request.clouds !== undefined) {
      params.append('clouds', request.clouds.toString());
    }

    return this.makeRequest<ImagerySearchResponse>(
      'GET',
      `/image/search?${params.toString()}`,
    );
  }

  /**
   * Get field statistics over a time period
   * Calculates average NDVI, min, max
   */
  async getFieldStatistics(
    fieldId: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    mean: number;
    min: number;
    max: number;
    count: number;
  }> {
    const ndviData = await this.getNDVIData({
      fieldId,
      start: startDate,
      end: endDate,
    });

    if (ndviData.length === 0) {
      return { mean: 0, min: 0, max: 0, count: 0 };
    }

    const values = ndviData.map(d => d.ndvi).filter(v => v !== null && v !== undefined);
    
    if (values.length === 0) {
      return { mean: 0, min: 0, max: 0, count: 0 };
    }

    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { mean, min, max, count: values.length };
  }

  /**
   * Compare NDVI before and after an event
   * Useful for claims processing
   */
  async compareNDVI(
    fieldId: string,
    beforeDate: string,
    afterDate: string,
  ): Promise<{
    before: number;
    after: number;
    change: number;
    changePercentage: number;
  }> {
    const beforeStats = await this.getFieldStatistics(fieldId, beforeDate, beforeDate);
    const afterStats = await this.getFieldStatistics(fieldId, afterDate, afterDate);

    const before = beforeStats.mean;
    const after = afterStats.mean;
    const change = after - before;
    const changePercentage = before !== 0 ? (change / before) * 100 : 0;

    return { before, after, change, changePercentage };
  }
}
