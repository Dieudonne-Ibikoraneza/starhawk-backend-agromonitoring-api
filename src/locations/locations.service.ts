import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Region, RegionDocument } from '../government/schemas/region.schema';
import { GovernmentLevel } from '../users/enums/government-level.enum';
import { RwandaLocationQueryDto } from './dto/rwanda-location-query.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectModel(Region.name) private readonly regionModel: Model<RegionDocument>,
  ) {}

  private sanitizeId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  private mapToDto(regions: RegionDocument[]) {
    return regions.map(r => ({
      id: r.regionId,
      name: r.name,
      slug: r.regionId,
      level: r.level.toLowerCase(),
    }));
  }

  async getProvinces(query: RwandaLocationQueryDto) {
    const filter: any = { level: GovernmentLevel.PROVINCE };
    if (query.q) {
      filter.name = { $regex: query.q, $options: 'i' };
    }
    const provinces = await this.regionModel.find(filter).sort({ name: 1 }).exec();
    return this.mapToDto(provinces);
  }

  async getDistricts(query: RwandaLocationQueryDto) {
    const filter: any = { level: GovernmentLevel.DISTRICT };
    if (query.p) {
      filter.parentId = `prov-${this.sanitizeId(query.p)}`;
    }
    if (query.q) {
      filter.name = { $regex: query.q, $options: 'i' };
    }
    const districts = await this.regionModel.find(filter).sort({ name: 1 }).exec();
    return this.mapToDto(districts);
  }

  async getSectors(query: RwandaLocationQueryDto) {
    if (!query.p || !query.d) {
      throw new BadRequestException('Province (p) and District (d) are required to get sectors.');
    }
    const parentId = `dist-${this.sanitizeId(query.d)}`;
    const filter: any = { level: GovernmentLevel.SECTOR, parentId };
    if (query.q) {
      filter.name = { $regex: query.q, $options: 'i' };
    }
    const sectors = await this.regionModel.find(filter).sort({ name: 1 }).exec();
    return this.mapToDto(sectors);
  }

  async getCells(query: RwandaLocationQueryDto) {
    if (!query.p || !query.d || !query.s) {
      throw new BadRequestException('Province (p), District (d), and Sector (s) are required to get cells.');
    }
    const parentId = `sect-${this.sanitizeId(query.d)}-${this.sanitizeId(query.s)}`;
    const filter: any = { level: GovernmentLevel.CELL, parentId };
    if (query.q) {
      filter.name = { $regex: query.q, $options: 'i' };
    }
    const cells = await this.regionModel.find(filter).sort({ name: 1 }).exec();
    return this.mapToDto(cells);
  }

  async getVillages(query: RwandaLocationQueryDto) {
    if (!query.p || !query.d || !query.s || !query.c) {
      throw new BadRequestException('Province (p), District (d), Sector (s), and Cell (c) are required to get villages.');
    }
    const parentId = `cell-${this.sanitizeId(query.s)}-${this.sanitizeId(query.c)}`;
    const filter: any = { level: GovernmentLevel.VILLAGE, parentId };
    if (query.q) {
      filter.name = { $regex: query.q, $options: 'i' };
    }
    const villages = await this.regionModel.find(filter).sort({ name: 1 }).exec();
    return this.mapToDto(villages);
  }
}
