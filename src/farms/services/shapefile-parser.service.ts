import { Injectable, BadRequestException } from '@nestjs/common';
import * as shapefile from 'shapefile';
import * as turf from '@turf/turf';
import * as toGeoJSON from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import { GeoJsonPolygonDto } from '../dto/create-farm.dto';

@Injectable()
export class ShapefileParserService {
  async parseShapefile(buffer: Buffer): Promise<GeoJsonPolygonDto> {
    try {
      // Parse shapefile
      const source = await shapefile.open(buffer);

      let geometries: any[] = [];
      let result = await source.read();
      while (!result.done) {
        if (result.value) {
          geometries.push(result.value);
        }
        result = await source.read();
      }

      if (geometries.length === 0) {
        throw new BadRequestException('Shapefile contains no geometry');
      }

      // If multiple geometries, combine them into a MultiPolygon
      if (geometries.length === 1) {
        const geometry = geometries[0].geometry;

        if (geometry.type === 'Polygon') {
          return {
            type: 'Polygon',
            coordinates: geometry.coordinates,
          };
        } else if (geometry.type === 'MultiPolygon') {
          return {
            type: 'MultiPolygon',
            coordinates: geometry.coordinates,
          };
        } else {
          // Convert other geometries to polygon if possible
          const polygon = turf.polygonize(geometry);
          if (polygon.features.length > 0) {
            return {
              type:
                polygon.features.length === 1 ? 'Polygon' : 'MultiPolygon',
              coordinates:
                polygon.features.length === 1
                  ? (polygon.features[0].geometry as any).coordinates
                  : polygon.features.map((f) => (f.geometry as any).coordinates),
            };
          }
          throw new BadRequestException(
            'Could not convert shapefile geometry to polygon',
          );
        }
      } else {
        // Multiple geometries - create MultiPolygon
        const polygons = geometries
          .map((g) => {
            if (g.geometry.type === 'Polygon') {
              return g.geometry.coordinates;
            } else if (g.geometry.type === 'MultiPolygon') {
              return g.geometry.coordinates.flat();
            }
            return null;
          })
          .filter((c) => c !== null);

        if (polygons.length === 0) {
          throw new BadRequestException(
            'Could not extract polygons from shapefile',
          );
        }

        return {
          type: 'MultiPolygon',
          coordinates: polygons,
        };
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to parse shapefile: ${error.message}`,
      );
    }
  }

  calculateArea(boundary: GeoJsonPolygonDto): number {
    try {
      if (boundary.type === 'Polygon') {
        const polygon = turf.polygon(boundary.coordinates as number[][][]);
        const area = turf.area(polygon); // Returns area in square meters
        return area / 10000; // Convert to hectares
      } else {
        // MultiPolygon
        const multiPolygon = turf.multiPolygon(
          boundary.coordinates as number[][][][],
        );
        const area = turf.area(multiPolygon);
        return area / 10000; // Convert to hectares
      }
    } catch (error) {
      throw new BadRequestException(
        `Failed to calculate area: ${error.message}`,
      );
    }
  }

  calculateCentroid(boundary: GeoJsonPolygonDto): [number, number] {
    try {
      let centroid;
      if (boundary.type === 'Polygon') {
        const polygon = turf.polygon(boundary.coordinates as number[][][]);
        centroid = turf.centroid(polygon);
      } else {
        const multiPolygon = turf.multiPolygon(
          boundary.coordinates as number[][][][],
        );
        centroid = turf.centroid(multiPolygon);
      }
      return centroid.geometry.coordinates as [number, number];
    } catch (error) {
      throw new BadRequestException(
        `Failed to calculate centroid: ${error.message}`,
      );
    }
  }

  async parseKML(kmlBuffer: Buffer): Promise<GeoJsonPolygonDto> {
    try {
      const kmlString = kmlBuffer.toString('utf-8');
      const kmlDoc = new DOMParser().parseFromString(kmlString, 'text/xml');

      // Convert KML to GeoJSON
      const geojson = toGeoJSON.kml(kmlDoc);

      if (!geojson || !geojson.features || geojson.features.length === 0) {
        throw new BadRequestException('KML file contains no geometry');
      }

      // Find polygons in the features
      const polygons: any[] = [];

      const extractPolygons = (feature: any) => {
        if (feature.geometry) {
          if (
            feature.geometry.type === 'Polygon' ||
            feature.geometry.type === 'MultiPolygon'
          ) {
            polygons.push(feature.geometry);
          } else if (feature.geometry.type === 'GeometryCollection') {
            feature.geometry.geometries.forEach((geom: any) => {
              if (
                geom.type === 'Polygon' ||
                geom.type === 'MultiPolygon'
              ) {
                polygons.push(geom);
              }
            });
          }
        }
      };

      geojson.features.forEach(extractPolygons);

      if (polygons.length === 0) {
        throw new BadRequestException(
          'KML file does not contain Polygon or MultiPolygon geometry',
        );
      }

      // If single polygon, return it
      if (polygons.length === 1) {
        const geom = polygons[0];
        return {
          type: geom.type as 'Polygon' | 'MultiPolygon',
          coordinates: geom.coordinates,
        };
      }

      // Multiple polygons - combine into MultiPolygon
      const allCoordinates: number[][][] = [];
      polygons.forEach((poly) => {
        if (poly.type === 'Polygon') {
          allCoordinates.push(poly.coordinates);
        } else if (poly.type === 'MultiPolygon') {
          allCoordinates.push(...poly.coordinates);
        }
      });

      if (allCoordinates.length === 0) {
        throw new BadRequestException(
          'Could not extract polygon coordinates from KML',
        );
      }

      return {
        type: 'MultiPolygon',
        coordinates: allCoordinates,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to parse KML file: ${error.message}`,
      );
    }
  }
}

