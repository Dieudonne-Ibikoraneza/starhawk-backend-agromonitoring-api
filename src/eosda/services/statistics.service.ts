import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EosdaBaseService, AsyncTaskResponse } from './eosda-base.service';
import { EosdaConfig } from '../eosda.config';

/**
 * EOSDA Statistics API (GDW) Service
 * Handles multi-temporal statistics for vegetation indices
 * 
 * Endpoint: POST /api/gdw/api (2-step async)
 * 
 * Business Integration:
 * - Risk Assessment: Historical NDVI statistics for risk scoring
 * - Claims Processing: Before/after statistics for damage assessment
 * - Ongoing Monitoring: Current statistics for alert generation
 */

export interface StatisticsRequest {
  fieldId?: string; // Use field_id OR geometry
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string; // ISO date string (YYYY-MM-DD)
  indices?: string[]; // ['NDVI', 'MSAVI', 'NDMI', 'EVI', etc.]
  sensors?: ('sentinel2' | 'sentinel1')[]; // Default: ['sentinel2']
  limit?: number; // Max data points (default: 100)
  excludeCoverPixels?: boolean; // Exclude clouds (default: true)
  cloudMaskingLevel?: 'best' | 'normal' | 'basic'; // Default: 'best'
}

export interface StatisticsDataPoint {
  date: string;
  mean: number;
  std_dev: number;
  min: number;
  max: number;
  median: number;
  cloud_coverage?: number;
}

export interface IndexStatistics {
  data: StatisticsDataPoint[];
  statistics: {
    overall_mean: number;
    overall_min: number;
    overall_max: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface StatisticsResponse {
  NDVI?: IndexStatistics;
  MSAVI?: IndexStatistics;
  NDMI?: IndexStatistics;
  EVI?: IndexStatistics;
  [key: string]: IndexStatistics | undefined;
}

export interface GDWTaskResponse {
  status: 'created';
  task_id: string;
  req_id: string;
  task_timeout: number; // Seconds (default: 172800 = 48 hours)
}

export interface GDWStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  progress?: number; // Percentage (0-100)
  result?: StatisticsResponse;
  error?: string;
}

@Injectable()
export class StatisticsService extends EosdaBaseService {
  constructor(httpService: HttpService, config: EosdaConfig) {
    super(httpService, config);
  }

  /**
   * Get multi-temporal statistics for one or more indices
   * Endpoint: POST /api/gdw/api (type: "mt_stats")
   * This is a 2-step async operation:
   * 1. POST creates task → returns task_id
   * 2. GET polls for results using task_id
   * 
   * @param request Statistics request parameters
   * @returns Statistics for requested indices
   */
  async getStatistics(
    request: StatisticsRequest,
  ): Promise<StatisticsResponse> {
    // Build params object - use field_id OR geometry (field_id is faster)
    const params: any = {
      bm_type: request.indices || ['NDVI'], // Biomass types (indices)
      date_start: request.startDate,
      date_end: request.endDate,
      sensors: request.sensors || ['sentinel2'],
      limit: request.limit || 100,
      exclude_cover_pixels: request.excludeCoverPixels !== false, // Default: true
      cloud_masking_level: request.cloudMaskingLevel || 'best',
    };

    // Use field_id if available (faster), otherwise use geometry
    if (request.fieldId) {
      params.field_id = request.fieldId;
    } else if (request.geometry) {
      params.geometry = request.geometry;
    } else {
      throw new Error('Either fieldId or geometry must be provided');
    }

    // Step 1: Create task
    const taskResponse = await this.makeRequest<GDWTaskResponse>(
      'POST',
      '/api/gdw/api',
      {
        type: 'mt_stats',
        params,
      },
    );

    const taskId = taskResponse.task_id;

    if (!taskId) {
      throw new Error('Failed to get task_id from EOSDA');
    }

    this.logger.log(
      `Statistics task created: ${taskId} (timeout: ${taskResponse.task_timeout}s)`,
    );

    // Step 2: Poll for results
    // Note: GDW API uses task_id in path with api_key as query param
    return this.pollAsyncTask<StatisticsResponse>(
      async () => {
        const apiKey = this.config.getApiKey();
        const url = `${this.config.getApiUrl()}/api/gdw/api/${taskId}?api_key=${apiKey}`;
        const headers = this.config.getHeaders();
        
        const { data: response } = await this.httpService.axiosRef.get<GDWStatusResponse>(url, { headers });
        
        return {
          task_id: taskId,
          status: response.status as any,
          result: response.result,
          error: response.error,
          progress: response.progress,
        };
      },
      20, // More attempts for GDW (can take longer)
      3000, // Start with 3 seconds delay
    );
  }

  /**
   * Get NDVI time series (convenience method)
   * @deprecated Use getStatistics with indices: ['NDVI'] instead
   */
  async getNDVITimeSeries(
    request: StatisticsRequest,
  ): Promise<{
    fieldId?: string;
    indices: { NDVI: Array<{ date: string; value: number }> };
    period: { start: string; end: string };
  }> {
    const stats = await this.getStatistics({
      ...request,
      indices: ['NDVI'],
    });

    const ndviData = stats.NDVI;
    if (!ndviData) {
      throw new Error('No NDVI data returned');
    }

    return {
      fieldId: request.fieldId,
      indices: {
        NDVI: ndviData.data.map((d) => ({
          date: d.date,
          value: d.mean, // Use mean as the value
        })),
      },
      period: {
        start: request.startDate,
        end: request.endDate,
      },
    };
  }

  /**
   * @deprecated Use getStatistics instead
   */
  async getVegetationIndices(
    fieldId: string,
    date: string,
  ): Promise<Record<string, number>> {
    const stats = await this.getStatistics({
      fieldId,
      startDate: date,
      endDate: date,
      indices: ['NDVI', 'MSAVI', 'NDMI', 'EVI'],
      limit: 1,
    });

    const result: Record<string, number> = {};
    
    if (stats.NDVI?.data[0]) {
      result.NDVI = stats.NDVI.data[0].mean;
    }
    if (stats.MSAVI?.data[0]) {
      result.MSAVI = stats.MSAVI.data[0].mean;
    }
    if (stats.NDMI?.data[0]) {
      result.NDMI = stats.NDMI.data[0].mean;
    }
    if (stats.EVI?.data[0]) {
      result.EVI = stats.EVI.data[0].mean;
    }

    return result;
  }
}
