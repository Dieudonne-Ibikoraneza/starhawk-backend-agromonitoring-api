import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EosdaBaseService } from './eosda-base.service';
import { EosdaConfig } from '../eosda.config';

export interface ImageryRequest {
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  startDate?: string;
  endDate?: string;
  cloudCoverage?: number; // 0-100
}

export interface ImageryResponse {
  id: string;
  geometry: any;
  date: string;
  cloudCoverage: number;
  url: string;
  thumbnailUrl?: string;
  metadata: Record<string, any>;
}

@Injectable()
export class ImageryService extends EosdaBaseService {
  constructor(httpService: HttpService, config: EosdaConfig) {
    super(httpService, config);
  }

  async requestImagery(
    request: ImageryRequest,
  ): Promise<ImageryResponse> {
    return this.makeRequest<ImageryResponse>(
      'POST',
      '/imagery/request',
      request,
    );
  }

  async getImagery(imageryId: string): Promise<ImageryResponse> {
    return this.makeRequest<ImageryResponse>('GET', `/imagery/${imageryId}`);
  }

  async searchImagery(
    request: ImageryRequest,
  ): Promise<ImageryResponse[]> {
    return this.makeRequest<ImageryResponse[]>(
      'POST',
      '/imagery/search',
      request,
    );
  }

  async getImageryForDate(
    geometry: ImageryRequest['geometry'],
    date: string,
  ): Promise<ImageryResponse | null> {
    const results = await this.searchImagery({
      geometry,
      startDate: date,
      endDate: date,
    });

    return results.length > 0 ? results[0] : null;
  }
}

