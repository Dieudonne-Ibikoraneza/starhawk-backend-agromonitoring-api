import { RwandaLocationNode } from '../types/rwanda-location.types';

export interface RwandaLocationSource {
  getProvinces(): Promise<RwandaLocationNode[]>;
  getDistricts(province: RwandaLocationNode): Promise<RwandaLocationNode[]>;
  getSectors(district: RwandaLocationNode): Promise<RwandaLocationNode[]>;
  getVillages(sector: RwandaLocationNode): Promise<RwandaLocationNode[]>;
  getCells(village: RwandaLocationNode): Promise<RwandaLocationNode[]>;
}

