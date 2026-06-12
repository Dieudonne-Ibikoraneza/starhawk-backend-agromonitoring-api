import { Injectable } from '@nestjs/common';
import { STATIC_RWANDA_LOCATION_TREE } from '../data/static-rwanda-locations';
import { RwandaLocationSource } from './rwanda-location-source.interface';
import { RwandaLocationNode } from '../types/rwanda-location.types';

@Injectable()
export class StaticRwandaLocationSource implements RwandaLocationSource {
  async getProvinces(): Promise<RwandaLocationNode[]> {
    return STATIC_RWANDA_LOCATION_TREE.map((province) => this.stripChildren(province));
  }

  async getDistricts(province: RwandaLocationNode): Promise<RwandaLocationNode[]> {
    const found = STATIC_RWANDA_LOCATION_TREE.find((item) => item.slug === province.slug);
    return (found?.children ?? []).map((district) => this.stripChildren(district));
  }

  async getSectors(district: RwandaLocationNode): Promise<RwandaLocationNode[]> {
    for (const province of STATIC_RWANDA_LOCATION_TREE) {
      const foundDistrict = province.children?.find((item) => item.slug === district.slug);
      if (foundDistrict) {
        return (foundDistrict.children ?? []).map((sector) => this.stripChildren(sector));
      }
    }

    return [];
  }

  async getVillages(_sector: RwandaLocationNode): Promise<RwandaLocationNode[]> {
    return [];
  }

  async getCells(_village: RwandaLocationNode): Promise<RwandaLocationNode[]> {
    return [];
  }

  private stripChildren(node: RwandaLocationNode): RwandaLocationNode {
    return {
      id: node.id,
      name: node.name,
      slug: node.slug,
      level: node.level,
      parentId: node.parentId,
      parentSlug: node.parentSlug,
    };
  }
}
