import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EosdaBaseService } from './eosda-base.service';
import { EosdaConfig } from '../eosda.config';

/**
 * EOSDA Field Analytics API Service
 * Handles vegetation indices, NDVI time series, and field statistics
 * 
 * Business Integration:
 * - Risk Assessment: Historical NDVI trends for risk scoring
 * - Claims Processing: NDVI before/after comparison for damage analysis
 * - Ongoing Monitoring: Current NDVI for alert generation
 */

export interface FieldTrendRequest {
  fieldId: string;
  dateStart: string; // ISO date string (YYYY-MM-DD)
  dateEnd: string; // ISO date string (YYYY-MM-DD)
  index?: 'NDVI' | 'MSAVI' | 'NDMI' | 'EVI'; // Default: NDVI
  dataSource?: 'S2' | 'S1'; // Default: S2 (Sentinel-2)
}

export interface FieldTrendResponse {
  field_id: string;
  index: string;
  date_range: {
    start: string;
    end: string;
  };
  data: Array<{
    date: string;
    value: number;
    cloud_coverage?: number;
  }>;
  statistics: {
    mean: number;
    min: number;
    max: number;
    std_dev: number;
  };
}

export interface ClassificationAreaRequest {
  fieldId: string;
  viewId: string; // From scene search (e.g., "S2/13/R/EL/2023/5/20/0")
  index?: 'NDVI' | 'MSAVI' | 'NDMI' | 'EVI'; // Default: NDVI
  dataSource?: 'S2' | 'S2L2A' | 'S1'; // Default: S2L2A
  thresholds?: Array<[number, number]>; // e.g., [[0.0, 0.3], [0.3, 0.6], [0.6, 1.0]]
  colors?: string[]; // Hex colors for each threshold (e.g., ["FF0000", "FFFF00", "00FF00"])
}

export interface ClassificationAreaResponse {
  field_id: string;
  view_id: string;
  date: string;
  classifications: Array<{
    class: string;
    threshold: [number, number];
    area_hectares: number;
    percentage: number;
  }>;
  total_area: number;
  image_url?: string;
}

// Legacy interfaces for backward compatibility
export interface AnalyticsRequest {
  fieldId: string;
  startDate: string;
  endDate: string;
  indices?: string[];
  aggregation?: 'daily' | 'weekly' | 'monthly';
}

export interface IndexDataPoint {
  date: string; // ISO date string
  value: number;
  quality?: number; // Data quality score 0-1
}

export interface AnalyticsResponse {
  fieldId: string;
  indices: {
    NDVI?: IndexDataPoint[];
    EVI?: IndexDataPoint[];
    NDWI?: IndexDataPoint[];
    GCI?: IndexDataPoint[];
    [key: string]: IndexDataPoint[] | undefined;
  };
  period: {
    start: string;
    end: string;
  };
  metadata?: {
    totalPoints: number;
    averageCloudCoverage?: number;
  };
}

export interface CurrentIndicesResponse {
  fieldId: string;
  date: string;
  indices: {
    NDVI?: number;
    EVI?: number;
    NDWI?: number;
    GCI?: number;
    [key: string]: number | undefined;
  };
}

@Injectable()
export class FieldAnalyticsService extends EosdaBaseService {
  constructor(httpService: HttpService, config: EosdaConfig) {
    super(httpService, config);
  }

  /**
   * Get field trend (NDVI or other index over time)
   * Endpoint: POST /field-analytics/trend/{field_id} (2-step async)
   * Used in: Risk assessment (historical trends), Claims (before/after comparison)
   * 
   * Example Usage:
   * - Risk Assessment: Get 3-year NDVI history to calculate trend
   * - Claims: Compare NDVI before and after loss event
   */
  async getFieldTrend(
    request: FieldTrendRequest,
  ): Promise<FieldTrendResponse> {
    const params = {
      date_start: request.dateStart,
      date_end: request.dateEnd,
      index: request.index || 'NDVI',
      data_source: request.dataSource || 'S2',
    };

    // Step 1: Create task
    const taskResponse = await this.makeRequest<{ request_id: string; status: string }>(
      'POST',
      `/field-analytics/trend/${request.fieldId}`,
      { params },
    );

    const requestId = taskResponse.request_id;

    if (!requestId) {
      throw new Error('Failed to get request_id from EOSDA');
    }

    // Step 2: Poll for results
    return this.pollAsyncTask<FieldTrendResponse>(
      async () => {
        const response = await this.makeRequest<{
          status: string;
          result?: FieldTrendResponse;
          error?: string;
        }>(
          'GET',
          `/field-analytics/trend/${request.fieldId}/${requestId}`,
        );
        return {
          request_id: requestId,
          status: response.status as any,
          result: response.result,
          error: response.error,
        };
      },
    );
  }

  /**
   * Get classification area for a field
   * Endpoint: POST /classification-area/{field_id} (2-step async)
   * Used in: Field health classification, damage assessment
   */
  async getClassificationArea(
    request: ClassificationAreaRequest,
  ): Promise<ClassificationAreaResponse> {
    const params = {
      index: request.index || 'NDVI',
      view_id: request.viewId,
      data_source: request.dataSource || 'S2L2A',
      thresholds: request.thresholds || [[0.0, 0.3], [0.3, 0.6], [0.6, 1.0]],
      colors: request.colors || ['FF0000', 'FFFF00', '00FF00'],
    };

    // Step 1: Create task
    const taskResponse = await this.makeRequest<{ request_id: string; status: string }>(
      'POST',
      `/classification-area/${request.fieldId}`,
      { params },
    );

    const requestId = taskResponse.request_id;

    if (!requestId) {
      throw new Error('Failed to get request_id from EOSDA');
    }

    // Step 2: Poll for results
    return this.pollAsyncTask<ClassificationAreaResponse>(
      async () => {
        const response = await this.makeRequest<{
          status: string;
          result?: ClassificationAreaResponse;
          error?: string;
        }>(
          'GET',
          `/classification-area/${request.fieldId}/${requestId}`,
        );
        return {
          request_id: requestId,
          status: response.status as any,
          result: response.result,
          error: response.error,
        };
      },
    );
  }

  /**
   * @deprecated Use getFieldTrend instead
   */
  async getNDVITimeSeries(
    request: AnalyticsRequest,
  ): Promise<AnalyticsResponse> {
    const trendData = await this.getFieldTrend({
      fieldId: request.fieldId,
      dateStart: request.startDate,
      dateEnd: request.endDate,
      index: 'NDVI',
    });

    // Convert to legacy format
    return {
      fieldId: trendData.field_id,
      indices: {
        NDVI: trendData.data.map((d) => ({
          date: d.date,
          value: d.value,
          quality: d.cloud_coverage ? 1 - d.cloud_coverage : undefined,
        })),
      },
      period: {
        start: trendData.date_range.start,
        end: trendData.date_range.end,
      },
      metadata: {
        totalPoints: trendData.data.length,
        averageCloudCoverage: trendData.data.reduce((sum, d) => sum + (d.cloud_coverage || 0), 0) / trendData.data.length,
      },
    };
  }

  /**
   * @deprecated Use getFieldTrend with multiple indices via Statistics Service instead
   */
  async getAnalytics(
    request: AnalyticsRequest,
  ): Promise<AnalyticsResponse> {
    // Use getFieldTrend for primary index
    const primaryIndex = request.indices?.[0] || 'NDVI';
    const trendData = await this.getFieldTrend({
      fieldId: request.fieldId,
      dateStart: request.startDate,
      dateEnd: request.endDate,
      index: primaryIndex as any,
    });

    // Convert to legacy format
    const indices: any = {};
    indices[primaryIndex] = trendData.data.map((d) => ({
      date: d.date,
      value: d.value,
      quality: d.cloud_coverage ? 1 - d.cloud_coverage : undefined,
    }));

    return {
      fieldId: trendData.field_id,
      indices,
      period: {
        start: trendData.date_range.start,
        end: trendData.date_range.end,
      },
      metadata: {
        totalPoints: trendData.data.length,
        averageCloudCoverage: trendData.data.reduce((sum, d) => sum + (d.cloud_coverage || 0), 0) / trendData.data.length,
      },
    };
  }

  /**
   * @deprecated Not available in EOSDA API - use getFieldTrend for date range instead
   */
  async getCurrentIndices(
    fieldId: string,
  ): Promise<CurrentIndicesResponse> {
    // Get recent trend data and return latest
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const trendData = await this.getFieldTrend({
      fieldId,
      dateStart: weekAgo.toISOString().split('T')[0],
      dateEnd: today.toISOString().split('T')[0],
      index: 'NDVI',
    });

    if (trendData.data.length === 0) {
      throw new Error('No recent data available');
    }

    const latest = trendData.data[trendData.data.length - 1];
    return {
      fieldId,
      date: latest.date,
      indices: {
        NDVI: latest.value,
      },
    };
  }

  /**
   * @deprecated Not available in EOSDA API - use getFieldTrend for date range instead
   */
  async getIndicesForDate(
    fieldId: string,
    date: string,
  ): Promise<CurrentIndicesResponse> {
    // Get trend data for the specific date
    const trendData = await this.getFieldTrend({
      fieldId,
      dateStart: date,
      dateEnd: date,
      index: 'NDVI',
    });

    if (trendData.data.length === 0) {
      throw new Error(`No data available for date ${date}`);
    }

    const dataPoint = trendData.data[0];
    return {
      fieldId,
      date: dataPoint.date,
      indices: {
        NDVI: dataPoint.value,
      },
    };
  }

  /**
   * Calculate NDVI trend (declining, stable, improving)
   * Helper method that analyzes time series data
   */
  calculateNDVITrend(
    ndviData: IndexDataPoint[],
  ): { trend: 'declining' | 'stable' | 'improving'; slope: number } {
    if (ndviData.length < 2) {
      return { trend: 'stable', slope: 0 };
    }

    // Simple linear regression
    const n = ndviData.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    ndviData.forEach((point, index) => {
      sumX += index;
      sumY += point.value;
      sumXY += index * point.value;
      sumX2 += index * index;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    let trend: 'declining' | 'stable' | 'improving';
    if (slope < -0.001) {
      trend = 'declining';
    } else if (slope > 0.001) {
      trend = 'improving';
    } else {
      trend = 'stable';
    }

    return { trend, slope };
  }
}

