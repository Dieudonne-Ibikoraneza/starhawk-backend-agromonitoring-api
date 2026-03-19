import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AgromonitoringBaseService } from './agromonitoring-base.service';
import { AgromonitoringConfig } from '../agromonitoring.config';

/**
 * AGROmonitoring Field Management API Service
 * Handles field creation, updates, and management
 *
 * Business Integration:
 * - Farm Registration: Creates field when farm is registered
 * - Field Updates: Syncs farm boundary changes
 * - Field Linking: Links MongoDB farm records with field IDs
 */

export interface CreateFieldRequest {
  name: string;
  geo_json: {
    type: 'Feature';
    properties: {
      name: string;
    };
    geometry: {
      type: 'Polygon' | 'MultiPolygon';
      coordinates: number[][][] | number[][][][];
    };
  };
  description?: string;
  cropType?: string; // Crop type for the field
  year?: number; // Year of planting
  sowingDate?: string; // Sowing date (ISO string)
}

export interface UpdateFieldRequest {
  name?: string;
  geo_json?: {
    type: 'Feature';
    properties: {
      name: string;
    };
    geometry: {
      type: 'Polygon' | 'MultiPolygon';
      coordinates: number[][][] | number[][][][];
    };
  };
  description?: string;
}

/**
 * AGROmonitoring Field Response (Polygon API Response)
 */
export interface FieldResponse {
  id: string;
  name: string;
  area: number; // Area in hectares (AGROmonitoring returns ha directly)
  center: [number, number]; // [lon, lat]
  geo_json: any;
  user_id?: string; // User ID from AGROmonitoring
}

@Injectable()
export class FieldManagementService extends AgromonitoringBaseService {
  constructor(httpService: HttpService, config: AgromonitoringConfig) {
    super(httpService, config);
  }

  /**
   * Clean coordinates - remove elevation (3rd value) if present
   * AGROmonitoring expects [lon, lat] format (2 values only)
   */
  private cleanCoordinates(coordinates: any): any {
    if (Array.isArray(coordinates)) {
      if (coordinates.length === 0) {
        return coordinates;
      }

      // Check if first element is a number (this is a coordinate pair)
      if (typeof coordinates[0] === 'number') {
        // It's a coordinate pair [lon, lat, elevation?]
        // Return only [lon, lat]
        return [coordinates[0], coordinates[1]];
      }

      // It's an array of coordinates, recursively process
      return coordinates.map((coord: any) => this.cleanCoordinates(coord));
    }

    return coordinates;
  }

  /**
   * Convert external field ID to AGROmonitoring field ID
   * This is a helper to generate deterministic field IDs from external systems
   */
  private generateFieldId(externalId: string): string {
    // Use a simple hash-like approach for generating field IDs
    // In production, you might want to store the mapping in a database
    return `field_${externalId}`;
  }

  /**
   * Create a new field in AGROmonitoring system
   *
   * API Endpoint: POST /agro/1.0/polygons
   * Response: Polygon object with id, area, geo_json, etc.
   */
  async createField(request: CreateFieldRequest): Promise<FieldResponse> {
    this.logger.log(`Creating AGROmonitoring field: ${request.name}`);

    // Ensure geometry is properly formatted
    const cleanedCoordinates = this.cleanCoordinates(request.geo_json.geometry.coordinates);

    const payload = {
      name: request.name,
      geo_json: {
        ...request.geo_json,
        geometry: {
          ...request.geo_json.geometry,
          coordinates: cleanedCoordinates,
        },
      },
    };

    return this.makeRequest<FieldResponse>('POST', '/agro/1.0/polygons', payload);
  }

  /**
   * Create field from existing farm data
   * Converts farm data to AGROmonitoring format
   */
  async createFieldFromFarm(
    farmId: string,
    farmName: string,
    geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any },
    description?: string,
  ): Promise<FieldResponse> {
    const request: CreateFieldRequest = {
      name: farmName,
      description: description || `Farm ID: ${farmId}`,
      geo_json: {
        type: 'Feature',
        properties: {
          name: farmName,
        },
        geometry: {
          type: geometry.type,
          coordinates: geometry.coordinates,
        },
      },
    };

    return this.createField(request);
  }

  /**
   * Get field by ID
   *
   * API Endpoint: GET /fields/{id}
   */
  async getField(fieldId: string): Promise<FieldResponse> {
    this.logger.log(`Getting AGROmonitoring field: ${fieldId}`);
    return this.makeRequest<FieldResponse>('GET', `/fields/${fieldId}`);
  }

  /**
   * Get all fields
   *
   * API Endpoint: GET /fields
   */
  async getAllFields(): Promise<FieldResponse[]> {
    this.logger.log('Getting all AGROmonitoring fields');
    return this.makeRequest<FieldResponse[]>('GET', '/fields');
  }

  /**
   * Update field
   *
   * API Endpoint: PUT /fields/{id}
   */
  async updateField(fieldId: string, request: UpdateFieldRequest): Promise<FieldResponse> {
    this.logger.log(`Updating AGROmonitoring field: ${fieldId}`);

    // Clean coordinates if geometry is provided
    let payload = request;
    if (request.geo_json && request.geo_json.geometry) {
      const cleanedCoordinates = this.cleanCoordinates(request.geo_json.geometry.coordinates);
      payload = {
        ...request,
        geo_json: {
          ...request.geo_json,
          geometry: {
            ...request.geo_json.geometry,
            coordinates: cleanedCoordinates,
          },
        },
      };
    }

    return this.makeRequest<FieldResponse>('PUT', `/fields/${fieldId}`, payload);
  }

  /**
   * Delete field
   *
   * API Endpoint: DELETE /fields/{id}
   */
  async deleteField(fieldId: string): Promise<{ deleted: boolean }> {
    this.logger.log(`Deleting AGROmonitoring field: ${fieldId}`);
    return this.makeRequest<{ deleted: boolean }>('DELETE', `/fields/${fieldId}`);
  }

  /**
   * Get field area in hectares
   */
  async getFieldArea(fieldId: string): Promise<number> {
    const field = await this.getField(fieldId);
    return field.area; // AGROmonitoring returns area directly in hectares
  }
}
