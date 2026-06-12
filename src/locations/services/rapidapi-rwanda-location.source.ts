import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RwandaLocationSource } from './rwanda-location-source.interface';
import { RwandaLocationNode } from '../types/rwanda-location.types';
import { normalizeLocationText } from './location-normalizer';

interface RapidApiLocationRecord {
  id?: string | number;
  name?: string;
  [key: string]: unknown;
}

@Injectable()
export class RapidApiRwandaLocationSource implements RwandaLocationSource {
  private readonly logger = new Logger(RapidApiRwandaLocationSource.name);
  private readonly baseUrl: string;
  private readonly host: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('RWANDA_API_BASE_URL', 'https://rwanda.p.rapidapi.com');
    this.host = this.configService.get<string>('RWANDA_API_HOST', 'rwanda.p.rapidapi.com');
    this.apiKey = this.configService.get<string>('RWANDA_API_KEY', '');
  }

  async getProvinces(): Promise<RwandaLocationNode[]> {
    const records = await this.request<RapidApiLocationRecord[]>('/provinces');
    return this.mapRecords(records, 'province');
  }

  async getDistricts(province: RwandaLocationNode): Promise<RwandaLocationNode[]> {
    const provinces = await this.getProvinces();
    const matchedProvince = provinces.find((item) => this.isSameLocation(item, province));
    if (!matchedProvince) {
      return [];
    }

    const records = await this.request<RapidApiLocationRecord[]>(`/provinces/${matchedProvince.id}/districts`);
    return this.mapRecords(records, 'district', matchedProvince);
  }

  async getSectors(district: RwandaLocationNode): Promise<RwandaLocationNode[]> {
    const provinces = await this.getProvinces();
    for (const province of provinces) {
      const districts = await this.getDistricts(province);
      const matchedDistrict = districts.find((item) => this.isSameLocation(item, district));
      if (!matchedDistrict) {
        continue;
      }

      const records = await this.request<RapidApiLocationRecord[]>(`/districts/${matchedDistrict.id}/sectors`);
      return this.mapRecords(records, 'sector', matchedDistrict);
    }

    return [];
  }

  async getVillages(sector: RwandaLocationNode): Promise<RwandaLocationNode[]> {
    const provinces = await this.getProvinces();
    for (const province of provinces) {
      const districts = await this.getDistricts(province);
      for (const district of districts) {
        const sectors = await this.getSectors(district);
        const matchedSector = sectors.find((item) => this.isSameLocation(item, sector));
        if (!matchedSector) {
          continue;
        }

        const records = await this.request<RapidApiLocationRecord[]>(`/sectors/${matchedSector.id}/villages`);
        return this.mapRecords(records, 'village', matchedSector);
      }
    }

    return [];
  }

  async getCells(village: RwandaLocationNode): Promise<RwandaLocationNode[]> {
    const provinces = await this.getProvinces();
    for (const province of provinces) {
      const districts = await this.getDistricts(province);
      for (const district of districts) {
        const sectors = await this.getSectors(district);
        for (const sector of sectors) {
          const villages = await this.getVillages(sector);
          const matchedVillage = villages.find((item) => this.isSameLocation(item, village));
          if (!matchedVillage) {
            continue;
          }

          const records = await this.request<RapidApiLocationRecord[]>(`/villages/${matchedVillage.id}/cells`);
          return this.mapRecords(records, 'cell', matchedVillage);
        }
      }
    }

    return [];
  }

  private async request<T>(endpoint: string): Promise<T> {
    if (!this.apiKey) {
      throw new Error('RWANDA_API_KEY is not configured');
    }

    const response = await firstValueFrom(
      this.httpService.get<T>(`${this.baseUrl}${endpoint}`, {
        headers: {
          'x-rapidapi-host': this.host,
          'x-rapidapi-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }),
    );

    return response.data;
  }

  private mapRecords(
    records: unknown,
    level: RwandaLocationNode['level'],
    parent?: RwandaLocationNode,
  ): RwandaLocationNode[] {
    const payload = records as unknown;
    const isArray = Array.isArray(payload);
    const payloadObject = isArray
      ? undefined
      : (payload as {
          data?: RapidApiLocationRecord[];
          results?: RapidApiLocationRecord[];
        });

    const items = isArray
      ? (payload as RapidApiLocationRecord[])
      : Array.isArray(payloadObject?.data)
        ? payloadObject.data
        : Array.isArray(payloadObject?.results)
          ? payloadObject.results
          : [];

    return items
      .filter((record) => typeof record?.name === 'string')
      .map((record) => ({
        id: String(record.id ?? normalizeLocationText(String(record.name))),
        name: String(record.name),
        slug:
          level === 'province'
            ? this.normalizeProvinceSlug(String(record.name))
            : normalizeLocationText(String(record.name)),
        level,
        parentId: parent?.id,
        parentSlug: parent?.slug,
      }));
  }

  private normalizeProvinceSlug(name: string): string {
    const normalized = normalizeLocationText(name);

    if (normalized.includes('kigali')) return 'kigali';
    if (normalized.includes('north')) return 'north';
    if (normalized.includes('south')) return 'south';
    if (normalized.includes('east')) return 'east';
    if (normalized.includes('west')) return 'west';

    return normalized;
  }

  private isSameLocation(a: RwandaLocationNode, b: RwandaLocationNode): boolean {
    return a.id === b.id || a.slug === b.slug || a.name.toLowerCase() === b.name.toLowerCase();
  }
}
