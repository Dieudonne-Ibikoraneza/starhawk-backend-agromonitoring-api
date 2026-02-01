import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EosdaBaseService, AsyncTaskResponse } from './eosda-base.service';
import { EosdaConfig } from '../eosda.config';

/**
 * EOSDA Field Imagery API Service
 * Handles satellite imagery retrieval and management
 * 
 * Business Integration:
 * - Risk Assessment: Historical imagery for field evaluation
 * - Claims Processing: Before/after imagery comparison for damage verification
 * - Farm Registration: Validate farm boundaries with satellite imagery
 */

export interface SceneSearchRequest {
  fieldId: string;
  dateStart: string; // ISO date string (YYYY-MM-DD)
  dateEnd: string; // ISO date string (YYYY-MM-DD)
  dataSource?: 'S2' | 'S1'; // Default: 'S2' (Sentinel-2)
  maxCloudCoverage?: number; // 0-100 percentage (default: 30)
}

export interface SceneSearchResponse {
  status: 'success';
  result: Array<{
    date: string; // ISO date string
    view_id: string; // e.g., "S2/13/R/EL/2024/1/5/0" - Store this!
    cloud: number; // Cloud coverage (0-1, e.g., 0.12 = 12%)
  }>;
  total_count: number;
}

export interface FieldIndexImageRequest {
  fieldId: string;
  viewId: string; // From scene search
  index?: 'NDVI' | 'MSAVI' | 'NDMI' | 'RGB' | 'EVI'; // Default: 'NDVI'
  format?: 'png' | 'tiff' | 'jpeg'; // Default: 'png'
}

export interface FieldIndexImageResponse {
  field_id: string;
  view_id: string;
  index: string;
  date: string;
  format: string;
  image_url: string; // URL to the image
  statistics?: {
    mean: number;
    min: number;
    max: number;
  };
}

// Legacy interfaces for backward compatibility
export interface ImagerySearchRequest {
  fieldId?: string;
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  startDate?: string;
  endDate?: string;
  cloudCoverage?: number;
  sensor?: string;
}

export interface ImageryResponse {
  id: string;
  fieldId?: string;
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  date: string;
  cloudCoverage: number;
  sensor: string;
  url: string;
  thumbnailUrl?: string;
  metadata: {
    resolution?: number;
    bands?: string[];
    coordinateSystem?: string;
    [key: string]: any;
  };
}

export interface ImageryComparisonRequest {
  fieldId: string;
  beforeDate: string;
  afterDate: string;
}

export interface ImageryComparisonResponse {
  before: ImageryResponse;
  after: ImageryResponse;
  differenceUrl?: string;
}

@Injectable()
export class FieldImageryService extends EosdaBaseService {
  constructor(httpService: HttpService, config: EosdaConfig) {
    super(httpService, config);
  }

  /**
   * Search for available scenes (satellite imagery)
   * Endpoint: POST /scene-search/for-field/{field_id} (2-step async)
   * 
   * This returns view_id values that are needed for:
   * - getFieldIndexImage() - to get processed index images
   * - getClassificationArea() - to classify field areas
   * 
   * @param request Scene search parameters
   * @returns Array of available scenes with view_id and cloud coverage
   */
  async searchScenes(
    request: SceneSearchRequest,
  ): Promise<SceneSearchResponse> {
    const params = {
      date_start: request.dateStart,
      date_end: request.dateEnd,
      data_source: request.dataSource || 'S2',
      max_cloud_coverage: request.maxCloudCoverage || 30,
    };

    // Step 1: Create task
    const taskResponse = await this.makeRequest<{
      request_id: string;
      status: string;
    }>(
      'POST',
      `/scene-search/for-field/${request.fieldId}`,
      { params },
    );

    const requestId = taskResponse.request_id;

    if (!requestId) {
      throw new Error('Failed to get request_id from EOSDA');
    }

    // Step 2: Poll for results
    return this.pollAsyncTask<SceneSearchResponse>(
      async () => {
        const response = await this.makeRequest<{
          status: string;
          result?: SceneSearchResponse['result'];
          total_count?: number;
          error?: string;
        }>(
          'GET',
          `/scene-search/for-field/${request.fieldId}/${requestId}`,
        );
        return {
          request_id: requestId,
          status: response.status as any,
          result: response.result ? {
            status: 'success',
            result: response.result,
            total_count: response.total_count || response.result.length,
          } : undefined,
          error: response.error,
        };
      },
    );
  }

  /**
   * Get field index image (NDVI, MSAVI, etc.)
   * Endpoint: POST /field-imagery/indicies/{field_id} (2-step async)
   * 
   * Requires view_id from searchScenes()
   * 
   * @param request Index image request with view_id
   * @returns Image URL and statistics
   */
  async getFieldIndexImage(
    request: FieldIndexImageRequest,
  ): Promise<FieldIndexImageResponse> {
    const params = {
      view_id: request.viewId,
      index: request.index || 'NDVI',
      format: request.format || 'png',
    };

    // Step 1: Create task
    const taskResponse = await this.makeRequest<{
      request_id: string;
      status: string;
    }>(
      'POST',
      `/field-imagery/indicies/${request.fieldId}`,
      { params },
    );

    const requestId = taskResponse.request_id;

    if (!requestId) {
      throw new Error('Failed to get request_id from EOSDA');
    }

    // Step 2: Poll for results
    return this.pollAsyncTask<FieldIndexImageResponse>(
      async () => {
        const response = await this.makeRequest<{
          status: string;
          result?: FieldIndexImageResponse;
          error?: string;
        }>(
          'GET',
          `/field-imagery/indicies/${request.fieldId}/${requestId}`,
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
   * @deprecated Use searchScenes instead
   */
  async searchImagery(
    request: ImagerySearchRequest,
  ): Promise<ImageryResponse[]> {
    if (!request.fieldId) {
      throw new Error(
        'searchImagery requires fieldId. Use searchScenes instead.',
      );
    }

    const scenes = await this.searchScenes({
      fieldId: request.fieldId,
      dateStart: request.startDate || new Date().toISOString().split('T')[0],
      dateEnd: request.endDate || new Date().toISOString().split('T')[0],
      maxCloudCoverage: request.cloudCoverage,
      dataSource: request.sensor === 'Sentinel-2' ? 'S2' : 'S2',
    });

    // Convert to legacy format
    return scenes.result.map((scene) => ({
      id: scene.view_id,
      fieldId: request.fieldId,
      geometry: request.geometry || {
        type: 'Polygon',
        coordinates: [],
      },
      date: scene.date,
      cloudCoverage: scene.cloud * 100, // Convert to percentage
      sensor: 'Sentinel-2',
      url: '', // Not available from scene search
      metadata: {
        view_id: scene.view_id,
      },
    }));
  }

  /**
   * Get imagery for a specific field and date
   * Uses searchScenes to find available imagery
   */
  async getImageryForFieldAndDate(
    fieldId: string,
    date: string,
  ): Promise<ImageryResponse | null> {
    const scenes = await this.searchScenes({
      fieldId,
      dateStart: date,
      dateEnd: date,
      maxCloudCoverage: 20, // Max 20% cloud coverage
    });

    if (scenes.result.length === 0) {
      return null;
    }

    const scene = scenes.result[0];
    return {
      id: scene.view_id,
      fieldId,
      geometry: {
        type: 'Polygon',
        coordinates: [],
      },
      date: scene.date,
      cloudCoverage: scene.cloud * 100,
      sensor: 'Sentinel-2',
      url: '', // Image URL requires getFieldIndexImage
      metadata: {
        view_id: scene.view_id,
      },
    };
  }

  /**
   * Get latest imagery for a field
   * Uses searchScenes to find most recent imagery
   */
  async getLatestImagery(
    fieldId: string,
  ): Promise<ImageryResponse | null> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const scenes = await this.searchScenes({
      fieldId,
      dateStart: startDate,
      dateEnd: endDate,
      maxCloudCoverage: 30,
    });

    if (scenes.result.length === 0) {
      return null;
    }

    // Sort by date descending and return most recent
    const sorted = [...scenes.result].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const scene = sorted[0];
    return {
      id: scene.view_id,
      fieldId,
      geometry: {
        type: 'Polygon',
        coordinates: [],
      },
      date: scene.date,
      cloudCoverage: scene.cloud * 100,
      sensor: 'Sentinel-2',
      url: '',
      metadata: {
        view_id: scene.view_id,
      },
    };
  }

  /**
   * @deprecated Not directly supported - use searchScenes + getFieldIndexImage
   */
  async getImageryComparison(
    request: ImageryComparisonRequest,
  ): Promise<ImageryComparisonResponse> {
    const [beforeScenes, afterScenes] = await Promise.all([
      this.searchScenes({
        fieldId: request.fieldId,
        dateStart: request.beforeDate,
        dateEnd: request.beforeDate,
        maxCloudCoverage: 20,
      }),
      this.searchScenes({
        fieldId: request.fieldId,
        dateStart: request.afterDate,
        dateEnd: request.afterDate,
        maxCloudCoverage: 20,
      }),
    ]);

    if (beforeScenes.result.length === 0 || afterScenes.result.length === 0) {
      throw new Error('Imagery not available for comparison dates');
    }

    const beforeScene = beforeScenes.result[0];
    const afterScene = afterScenes.result[0];

    // Get actual images
    const [beforeImage, afterImage] = await Promise.all([
      this.getFieldIndexImage({
        fieldId: request.fieldId,
        viewId: beforeScene.view_id,
      }),
      this.getFieldIndexImage({
        fieldId: request.fieldId,
        viewId: afterScene.view_id,
      }),
    ]);

    return {
      before: {
        id: beforeScene.view_id,
        fieldId: request.fieldId,
        geometry: { type: 'Polygon', coordinates: [] },
        date: beforeScene.date,
        cloudCoverage: beforeScene.cloud * 100,
        sensor: 'Sentinel-2',
        url: beforeImage.image_url,
        metadata: { view_id: beforeScene.view_id },
      },
      after: {
        id: afterScene.view_id,
        fieldId: request.fieldId,
        geometry: { type: 'Polygon', coordinates: [] },
        date: afterScene.date,
        cloudCoverage: afterScene.cloud * 100,
        sensor: 'Sentinel-2',
        url: afterImage.image_url,
        metadata: { view_id: afterScene.view_id },
      },
    };
  }

  /**
   * @deprecated Use getFieldIndexImage instead
   */
  async getImagery(imageryId: string): Promise<ImageryResponse> {
    throw new Error(
      'getImagery is deprecated. Use searchScenes + getFieldIndexImage instead.',
    );
  }
}
