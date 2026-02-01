import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EosdaBaseService } from './eosda-base.service';
import { EosdaConfig } from '../eosda.config';

/**
 * EOSDA Render API Service
 * Handles rendering of satellite imagery tiles
 * 
 * Endpoint: GET /api/render/{scene_path}
 * 
 * Scene Path Format:
 * {satellite}/{zone}/{latitude_band}/{grid_square}/{year}/{month}/{day}/{index}/NDVI/{zoom}/{x}/{y}
 * 
 * Example:
 * S2/36/U/XU/2016/5/2/0/NDVI/10/611/354
 * 
 * Business Integration:
 * - Maps: Display satellite imagery tiles on map interface (Leaflet, Mapbox)
 * - Reports: Generate static map images for reports
 */

export interface RenderImageRequest {
  scenePath: string; // Full scene path (e.g., "S2/36/U/XU/2016/5/2/0/NDVI/10/611/354")
  index?: string; // Override index in path (optional)
}

export interface RenderImageResponse {
  imageUrl?: string; // For backward compatibility
  imageData?: Buffer; // Binary image data (PNG)
  contentType: string; // "image/png"
}

/**
 * Build scene path from components
 * Scene Path Format:
 * {satellite}/{zone}/{latitude_band}/{grid_square}/{year}/{month}/{day}/{index}/NDVI/{zoom}/{x}/{y}
 */
export interface ScenePathComponents {
  satellite: 'S2' | 'S1'; // Satellite (S2 = Sentinel-2, S1 = Sentinel-1)
  zone: string; // UTM zone (e.g., "36")
  latitudeBand: string; // Latitude band (e.g., "U")
  gridSquare: string; // Grid square (e.g., "XU")
  year: number; // Year (e.g., 2016)
  month: number; // Month (1-12)
  day: number; // Day (1-31)
  index?: number; // Index number (usually 0)
  indexType?: 'NDVI' | 'MSAVI' | 'NDMI' | 'RGB'; // Index type (default: NDVI)
  zoom: number; // Zoom level (e.g., 10)
  x: number; // Tile X coordinate
  y: number; // Tile Y coordinate
}

// Legacy interfaces for backward compatibility
export interface RenderRequest {
  fieldId?: string;
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  date?: string;
  index?: string;
  style?: string;
  width?: number;
  height?: number;
}

export interface RenderResponse {
  imageUrl: string;
  thumbnailUrl?: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  metadata: {
    date?: string;
    index?: string;
    resolution?: number;
    [key: string]: any;
  };
}

@Injectable()
export class RenderService extends EosdaBaseService {
  constructor(httpService: HttpService, config: EosdaConfig) {
    super(httpService, config);
  }

  /**
   * Render satellite image tile
   * Endpoint: GET /api/render/{scene_path}?api_key=<api_key>
   * 
   * Response: Binary image data (PNG)
   * 
   * @param request Render request with scene path
   * @returns Image data buffer
   */
  async renderImage(
    request: RenderImageRequest,
  ): Promise<RenderImageResponse> {
    const apiKey = this.config.getApiKey();
    const url = `${this.config.getApiUrl()}/api/render/${request.scenePath}?api_key=${apiKey}`;
    const headers = this.config.getHeaders();

    // Remove Content-Type for binary response
    delete headers['Content-Type'];

    const response = await this.httpService.axiosRef.get(url, {
      headers,
      responseType: 'arraybuffer',
    });

    return {
      imageData: Buffer.from(response.data),
      contentType: response.headers['content-type'] || 'image/png',
    };
  }

  /**
   * Build scene path from components
   * Helper method to construct scene path from individual components
   * 
   * @param components Scene path components
   * @returns Scene path string
   */
  buildScenePath(components: ScenePathComponents): string {
    const {
      satellite,
      zone,
      latitudeBand,
      gridSquare,
      year,
      month,
      day,
      index = 0,
      indexType = 'NDVI',
      zoom,
      x,
      y,
    } = components;

    // Format: S2/36/U/XU/2016/5/2/0/NDVI/10/611/354
    return `${satellite}/${zone}/${latitudeBand}/${gridSquare}/${year}/${month}/${day}/${index}/${indexType}/${zoom}/${x}/${y}`;
  }

  /**
   * Parse scene path into components
   * Helper method to extract components from scene path
   * 
   * @param scenePath Scene path string
   * @returns Scene path components
   */
  parseScenePath(scenePath: string): ScenePathComponents {
    const parts = scenePath.split('/');
    
    if (parts.length < 10) {
      throw new Error(`Invalid scene path format: ${scenePath}`);
    }

    return {
      satellite: parts[0] as 'S2' | 'S1',
      zone: parts[1],
      latitudeBand: parts[2],
      gridSquare: parts[3],
      year: parseInt(parts[4], 10),
      month: parseInt(parts[5], 10),
      day: parseInt(parts[6], 10),
      index: parseInt(parts[7], 10),
      indexType: parts[8] as any,
      zoom: parseInt(parts[9], 10),
      x: parseInt(parts[10], 10),
      y: parseInt(parts[11], 10),
    };
  }

  /**
   * @deprecated Use renderImage with scene path instead
   * Render API doesn't support field-based rendering directly
   */
  async renderMap(request: RenderRequest): Promise<RenderResponse> {
    throw new Error(
      'renderMap is deprecated. Use renderImage with scene path. Get scene path from searchScenes() result (view_id).',
    );
  }

  /**
   * @deprecated Use renderImage with scene path instead
   */
  async renderNDVI(request: RenderRequest): Promise<RenderResponse> {
    throw new Error(
      'renderNDVI is deprecated. Use renderImage with scene path. Get scene path from searchScenes() result (view_id).',
    );
  }

  /**
   * @deprecated Use renderImage with scene paths instead
   */
  async renderComparison(
    fieldId: string,
    beforeDate: string,
    afterDate: string,
    geometry?: RenderRequest['geometry'],
  ): Promise<{
    before: RenderResponse;
    after: RenderResponse;
    differenceUrl?: string;
  }> {
    throw new Error(
      'renderComparison is deprecated. Use renderImage with scene paths from searchScenes().',
    );
  }

  /**
   * @deprecated Use renderImage with scene path instead
   */
  async renderIndex(
    request: RenderRequest & { index: string },
  ): Promise<RenderResponse> {
    throw new Error(
      'renderIndex is deprecated. Use renderImage with scene path. Get scene path from searchScenes() result (view_id).',
    );
  }
}
