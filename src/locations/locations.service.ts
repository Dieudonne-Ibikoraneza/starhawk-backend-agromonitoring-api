import { Injectable, BadRequestException } from '@nestjs/common';
import { RwandaLocationQueryDto } from './dto/rwanda-location-query.dto';
import { JsonRwandaLocationSource } from './services/json-rwanda-location.source';

@Injectable()
export class LocationsService {
  constructor(private readonly locationSource: JsonRwandaLocationSource) {}

  private filterByQuery<T extends { name: string; slug: string }>(nodes: T[], query?: string): T[] {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();
    return nodes.filter(
      (n) => n.name.toLowerCase().includes(lowerQuery) || n.slug.includes(lowerQuery)
    );
  }

  getTree() {
    return this.locationSource.getTree();
  }

  getProvinces(query: RwandaLocationQueryDto) {
    const nodes = this.locationSource.getProvinces();
    return this.filterByQuery(nodes, query.q);
  }

  getDistricts(query: RwandaLocationQueryDto) {
    if (!query.p) {
      // If no province specified, gather all districts
      const provinces = this.locationSource.getProvinces();
      let allDistricts: any[] = [];
      for (const prov of provinces) {
        allDistricts = allDistricts.concat(this.locationSource.getDistricts(prov.slug));
      }
      return this.filterByQuery(allDistricts, query.q);
    }
    const nodes = this.locationSource.getDistricts(query.p);
    return this.filterByQuery(nodes, query.q);
  }

  getSectors(query: RwandaLocationQueryDto) {
    if (!query.p || !query.d) {
      throw new BadRequestException('Province (p) and District (d) are required to get sectors.');
    }
    const nodes = this.locationSource.getSectors(query.p, query.d);
    return this.filterByQuery(nodes, query.q);
  }

  getCells(query: RwandaLocationQueryDto) {
    if (!query.p || !query.d || !query.s) {
      throw new BadRequestException('Province (p), District (d), and Sector (s) are required to get cells.');
    }
    const nodes = this.locationSource.getCells(query.p, query.d, query.s);
    return this.filterByQuery(nodes, query.q);
  }

  getVillages(query: RwandaLocationQueryDto) {
    if (!query.p || !query.d || !query.s || !query.c) {
      throw new BadRequestException('Province (p), District (d), Sector (s), and Cell (c) are required to get villages.');
    }
    const nodes = this.locationSource.getVillages(query.p, query.d, query.s, query.c);
    return this.filterByQuery(nodes, query.q);
  }
}
