import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EosdaBaseService } from './eosda-base.service';
import { EosdaConfig } from '../eosda.config';

/**
 * EOSDA Field Management API Service
 * Handles field creation, updates, and management in EOSDA system
 * 
 * Business Integration:
 * - Farm Registration: Creates EOSDA field when farm is registered
 * - Field Updates: Syncs farm boundary changes to EOSDA
 * - Field Linking: Links MongoDB farm records with EOSDA field IDs
 */
export interface CreateFieldRequest {
  name: string;
  group?: string; // Optional group name
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  cropType?: string;
  sowingDate?: string; // ISO date string (YYYY-MM-DD)
  year?: number; // Year for years_data
}

/**
 * EOSDA Field Response
 * Response format: { "id": 9793351, "area": "77.0" }
 */
export interface FieldResponse {
  id: number | string; // Field ID from EOSDA
  area: string; // Area in hectares as string
}

@Injectable()
export class FieldManagementService extends EosdaBaseService {
  constructor(httpService: HttpService, config: EosdaConfig) {
    super(httpService, config);
  }

  /**
   * Clean coordinates - remove elevation (3rd value) if present
   * EOSDA expects [lon, lat] format (2 values only)
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
   * Create a new field in EOSDA system
   * EOSDA expects GeoJSON Feature format:
   * {
   *   "type": "Feature",
   *   "properties": {
   *     "name": "my field",
   *     "group": "my group", (optional)
   *     "years_data": [ (optional - can be omitted)
   *       {
   *         "crop_type": "Wheat" | "Soybeans" | etc.,
   *         "year": 2023,
   *         "sowing_date": "2023-04-01"
   *       }
   *     ]
   *   },
   *   "geometry": {
   *     "type": "Polygon",
   *     "coordinates": [[[...]]]  // Must be [lon, lat] format (2 values)
   *   }
   * }
   * 
   * API Endpoint: POST /field-management
   * Headers: x-api-key: <your_api_key>
   * Response: { "id": 9793351, "area": "77.0" }
   * 
   * Note: years_data is OPTIONAL. If cropType cannot be mapped to valid EOSDA crop,
   * the field will be created without years_data.
   */
  async createField(request: CreateFieldRequest): Promise<FieldResponse> {
    this.logger.log(`Creating EOSDA field: ${request.name}`);

    // Validate geometry type
    if (request.geometry.type !== 'Polygon' && request.geometry.type !== 'MultiPolygon') {
      throw new Error(`Invalid geometry type: ${request.geometry.type}. Must be Polygon or MultiPolygon`);
    }

    // Clean coordinates - remove elevation (3rd value) if present
    // EOSDA expects [lon, lat] format, not [lon, lat, elevation]
    const cleanedCoordinates = this.cleanCoordinates(request.geometry.coordinates);

    // Build properties object matching EOSDA format
    const properties: any = {
      name: request.name,
    };

    // Add group if provided
    if (request.group) {
      properties.group = request.group;
    }

    // Add years_data ONLY if cropType can be mapped to valid EOSDA crop type
    // years_data is optional - EOSDA allows field creation without it
    if (request.cropType) {
      const mappedCropType = this.mapCropType(request.cropType);
      
      // Only add years_data if we have a valid EOSDA crop type
      if (mappedCropType) {
        const currentYear = request.year || new Date().getFullYear();
        const sowingDate = request.sowingDate || `${currentYear}-04-01`;
        
        properties.years_data = [
          {
            crop_type: mappedCropType,
            year: currentYear,
            sowing_date: sowingDate,
          },
        ];
        
        this.logger.debug(`Adding years_data with crop_type: ${mappedCropType}`);
      } else {
        this.logger.warn(
          `Crop type "${request.cropType}" cannot be mapped to valid EOSDA crop type. Creating field without years_data.`,
        );
      }
    }

    // Convert to GeoJSON Feature format as expected by EOSDA API
    const geoJsonFeature = {
      type: 'Feature',
      properties,
      geometry: {
        type: request.geometry.type,
        coordinates: cleanedCoordinates,
      },
    };

    // Log the full request for debugging
    this.logger.debug(`Full GeoJSON Feature being sent:`);
    this.logger.debug(JSON.stringify(geoJsonFeature, null, 2));

    // Use the correct endpoint according to EOSDA documentation
    try {
      const response = await this.makeRequest<FieldResponse>(
        'POST',
        '/field-management',
        geoJsonFeature,
      );

      this.logger.log(
        `Successfully created EOSDA field: ${response.id} (area: ${response.area} ha)`,
      );
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to create EOSDA field. Request body was: ${JSON.stringify(geoJsonFeature, null, 2).substring(0, 500)}`,
      );
      throw error;
    }
  }

  /**
   * Map internal crop type to EOSDA crop type format
   * Returns null if crop type cannot be mapped (will omit years_data)
   * 
   * Valid EOSDA crop types (confirmed from testing):
   * - Wheat
   * - Soybeans
   * - Rice (likely)
   * - Cotton (likely)
   * - Barley (likely)
   * - Oats (likely)
   * 
   * Invalid: Maize, Corn
   */
  private mapCropType(cropType: string): string | null {
    // EOSDA expects specific crop type names
    // Based on testing, these are known valid types:
    const validCropMap: Record<string, string | null> = {
      // Direct matches
      WHEAT: 'Wheat',
      SOYBEANS: 'Soybeans',
      
      // Common alternatives
      MAIZE: 'Soybeans', // Maize/Corn not supported, use Soybeans as fallback
      CORN: 'Soybeans',
      BEANS: 'Soybeans',
      
      // Likely valid (need confirmation)
      RICE: 'Rice',
      COTTON: 'Cotton',
      BARLEY: 'Barley',
      OATS: 'Oats',
      
      // Rwanda-specific crops - map to closest valid type
      SORGHUM: 'Barley', // Closest match
      POTATOES: null, // Not supported
      CASSAVA: null, // Not supported
      BANANAS: null, // Not supported
      COFFEE: null, // Not supported
      TEA: null, // Not supported
      OTHER: null, // Not supported
    };

    // Convert to uppercase to match enum values
    const upperCrop = cropType.toUpperCase();
    const mapped = validCropMap[upperCrop];

    if (mapped) {
      this.logger.debug(`Mapped crop type "${cropType}" to EOSDA crop type "${mapped}"`);
      return mapped;
    }

    // If not in map, return null to omit years_data (safer than risking invalid crop type)
    this.logger.warn(
      `Crop type "${cropType}" not in mapping. Creating field without years_data.`,
    );
    return null;
  }

  /**
   * Get all fields from EOSDA
   * Endpoint: GET /field-management/fields
   * Used when: Retrieving all fields for the authenticated user
   */
  async getAllFields(): Promise<FieldResponse[]> {
    return this.makeRequest<FieldResponse[]>(
      'GET',
      '/field-management/fields',
    );
  }

  /**
   * Get field details from EOSDA by ID
   * Endpoint: GET /field-management/fields/{field_id}
   * Used when: Retrieving farm information with EOSDA data
   */
  async getFieldById(fieldId: string): Promise<FieldResponse> {
    return this.makeRequest<FieldResponse>(
      'GET',
      `/field-management/fields/${fieldId}`,
    );
  }

  /**
   * @deprecated Use getFieldById instead
   */
  async getField(fieldId: string): Promise<FieldResponse> {
    return this.getFieldById(fieldId);
  }

  /**
   * Update field boundary or name
   * Endpoint: PUT /field-management/fields/{field_id}
   * Used when: Farmer updates farm boundary
   */
  async updateField(
    fieldId: string,
    updateData: Partial<CreateFieldRequest>,
  ): Promise<FieldResponse> {
    // Clean coordinates if geometry is provided
    let cleanedGeometry = updateData.geometry;
    if (cleanedGeometry) {
      cleanedGeometry = {
        ...cleanedGeometry,
        coordinates: this.cleanCoordinates(cleanedGeometry.coordinates),
      };
    }

    // Convert to GeoJSON Feature format if geometry is provided
    const payload: any = {};
    if (updateData.name) {
      payload.properties = { name: updateData.name };
    }
    if (cleanedGeometry) {
      payload.geometry = cleanedGeometry;
    }
    
    // Only add years_data if cropType can be mapped
    if (updateData.cropType) {
      const mappedCropType = this.mapCropType(updateData.cropType);
      if (mappedCropType) {
        payload.properties = {
          ...payload.properties,
          years_data: [
            {
              crop_type: mappedCropType,
              year: updateData.year || new Date().getFullYear(),
              sowing_date: updateData.sowingDate || `${new Date().getFullYear()}-04-01`,
            },
          ],
        };
      }
    }

    return this.makeRequest<FieldResponse>(
      'PUT',
      `/field-management/fields/${fieldId}`,
      payload,
    );
  }

  /**
   * Delete field from EOSDA
   * Endpoint: DELETE /field-management/fields/{field_id}
   * Used when: Farm is deleted from system
   * Response: 204 No Content on success
   */
  async deleteField(fieldId: string): Promise<void> {
    await this.makeRequest('DELETE', `/field-management/fields/${fieldId}`);
  }

  /**
   * List all fields for the authenticated user
   * @deprecated Use getAllFields instead
   */
  async listFields(): Promise<FieldResponse[]> {
    return this.getAllFields();
  }
}
