import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { normalizeLocationText } from './location-normalizer';
import { RwandaLocationNode, RwandaLocationTreeNode } from '../types/rwanda-location.types';

type RawVillageList = string[];
type RawCellMap = Record<string, RawVillageList>;
type RawSectorMap = Record<string, RawCellMap>;
type RawDistrictMap = Record<string, RawSectorMap>;
type RawRwandaData = Record<string, RawDistrictMap>;

@Injectable()
export class JsonRwandaLocationSource {
  private readonly logger = new Logger(JsonRwandaLocationSource.name);
  private readonly data: RawRwandaData;

  constructor() {
    this.data = this.loadData();
  }

  getProvinces(): RwandaLocationNode[] {
    return Object.keys(this.data).map((provinceName) =>
      this.toNode(provinceName, 'province'),
    );
  }

  getDistricts(provinceSlug: string): RwandaLocationNode[] {
    const provinceEntry = this.findEntry(this.data, provinceSlug);
    if (!provinceEntry) {
      return [];
    }

    return Object.keys(provinceEntry.value).map((districtName) =>
      this.toNode(districtName, 'district', provinceEntry.key),
    );
  }

  getSectors(provinceSlug: string, districtSlug: string): RwandaLocationNode[] {
    const districtMap = this.getDistrictMap(provinceSlug, districtSlug);
    if (!districtMap) {
      return [];
    }

    return Object.keys(districtMap).map((sectorName) =>
      this.toNode(sectorName, 'sector', districtSlug),
    );
  }

  getCells(provinceSlug: string, districtSlug: string, sectorSlug: string): RwandaLocationNode[] {
    const cellMap = this.getCellMap(provinceSlug, districtSlug, sectorSlug);
    if (!cellMap) {
      return [];
    }

    return Object.keys(cellMap).map((cellName) =>
      this.toNode(cellName, 'cell', sectorSlug),
    );
  }

  getVillages(
    provinceSlug: string,
    districtSlug: string,
    sectorSlug: string,
    cellSlug: string,
  ): RwandaLocationNode[] {
    const villages = this.getVillageList(provinceSlug, districtSlug, sectorSlug, cellSlug);
    return villages.map((villageName) => this.toNode(villageName, 'village', cellSlug));
  }

  getTree(): RwandaLocationTreeNode[] {
    return Object.entries(this.data).map(([provinceName, districts]) => ({
      ...this.toNode(provinceName, 'province'),
      children: Object.entries(districts).map(([districtName, sectors]) => ({
        ...this.toNode(districtName, 'district', provinceName),
        children: Object.entries(sectors).map(([sectorName, cells]) => ({
          ...this.toNode(sectorName, 'sector', districtName),
          children: Object.entries(cells).map(([cellName, villages]) => ({
            ...this.toNode(cellName, 'cell', sectorName),
            children: villages.map((villageName) => ({
              ...this.toNode(villageName, 'village', cellName),
              children: [],
            })),
          })),
        })),
      })),
    }));
  }

  private getDistrictMap(provinceSlug: string, districtSlug: string): RawSectorMap | undefined {
    const provinceEntry = this.findEntry(this.data, provinceSlug);
    if (!provinceEntry) {
      return undefined;
    }

    return this.findEntry(provinceEntry.value, districtSlug)?.value;
  }

  private getCellMap(
    provinceSlug: string,
    districtSlug: string,
    sectorSlug: string,
  ): RawCellMap | undefined {
    const districtMap = this.getDistrictMap(provinceSlug, districtSlug);
    if (!districtMap) {
      return undefined;
    }

    return this.findEntry(districtMap, sectorSlug)?.value;
  }

  private getVillageList(
    provinceSlug: string,
    districtSlug: string,
    sectorSlug: string,
    cellSlug: string,
  ): RawVillageList {
    const cellMap = this.getCellMap(provinceSlug, districtSlug, sectorSlug);
    if (!cellMap) {
      return [];
    }

    return this.findEntry(cellMap, cellSlug)?.value ?? [];
  }

  private findEntry<T>(record: Record<string, T>, slugOrName: string): { key: string; value: T } | undefined {
    const normalizedTarget = this.normalizeProvinceAlias(slugOrName);
    const match = Object.entries(record).find(([name]) => {
      const normalizedName = this.normalizeProvinceAlias(name);
      return normalizedName === normalizedTarget || normalizeLocationText(name) === normalizedTarget;
    });

    if (!match) {
      return undefined;
    }

    return { key: match[0], value: match[1] };
  }

  private toNode(
    name: string,
    level: RwandaLocationNode['level'],
    parentName?: string,
  ): RwandaLocationNode {
    const slug = level === 'province'
      ? this.normalizeProvinceAlias(name)
      : normalizeLocationText(name);

    return {
      id: slug,
      name,
      slug,
      level,
      parentSlug: parentName ? normalizeLocationText(parentName) : undefined,
    };
  }

  private normalizeProvinceAlias(value: string): string {
    const normalized = normalizeLocationText(value);

    if (normalized.includes('kigali')) return 'kigali';
    if (normalized.includes('east')) return 'east';
    if (normalized.includes('west')) return 'west';
    if (normalized.includes('north')) return 'north';
    if (normalized.includes('south')) return 'south';

    return normalized;
  }

  private loadData(): RawRwandaData {
    const configuredPath = process.env.RWANDA_DATA_PATH;
    const candidatePaths = [
      configuredPath,
      join(process.cwd(), '..', 'Rwanda', 'data.json'),
      join(process.cwd(), 'Rwanda', 'data.json'),
      join(process.cwd(), 'src', 'locations', 'data', 'rwanda-data.json'),
    ].filter((path): path is string => Boolean(path));

    const dataPath = candidatePaths.find((path) => existsSync(path));
    if (!dataPath) {
      this.logger.warn('Rwanda data file was not found. Location routes will return empty results.');
      return {};
    }

    const raw = readFileSync(dataPath, 'utf8');
    const parsed = JSON.parse(raw) as RawRwandaData | { provinces?: unknown };

    if (!this.isRawRwandaData(parsed)) {
      this.logger.warn(`Rwanda data file has an unsupported shape: ${dataPath}`);
      return {};
    }

    return parsed;
  }

  private isRawRwandaData(value: unknown): value is RawRwandaData {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }
}
