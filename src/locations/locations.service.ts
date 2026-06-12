import { Injectable, NotFoundException } from '@nestjs/common';
import { RwandaLocationQueryDto } from './dto/rwanda-location-query.dto';
import * as fs from 'fs';
import * as path from 'path';

export interface LocationNode {
  id: string;
  name: string;
  slug: string;
  level: string;
  children?: LocationNode[];
}

@Injectable()
export class LocationsService {
  private tree: LocationNode[] = [];

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      const filePath = path.join(process.cwd(), 'src', 'locations', 'data', 'rwanda-data.json');
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        this.tree = data.provinces || [];
      } else {
        // Fallback to check if Rwanda/rwanda.json exists at root
        const fallbackPath = path.join(process.cwd(), 'Rwanda', 'rwanda.json');
        if (fs.existsSync(fallbackPath)) {
            const fileContent = fs.readFileSync(fallbackPath, 'utf-8');
            const data = JSON.parse(fileContent);
            this.tree = data.provinces || data; // handle both shapes if possible
        } else {
            console.warn('rwanda-data.json not found');
        }
      }
    } catch (error) {
      console.error('Error loading rwanda-data.json', error);
    }
  }

  getTree() {
    return this.tree;
  }

  private filterByQuery(nodes: LocationNode[], query?: string) {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();
    return nodes.filter(
      (n) => n.name.toLowerCase().includes(lowerQuery) || n.slug.includes(lowerQuery)
    );
  }

  getProvinces(query: RwandaLocationQueryDto) {
    const nodes = this.tree.map(({ children, ...rest }) => rest);
    return this.filterByQuery(nodes as LocationNode[], query.q);
  }

  getDistricts(query: RwandaLocationQueryDto) {
    if (!query.p) {
      // If no province is specified, we could return all districts, but API expects filtering by province usually
      // However, if they just hit /districts, we can return all.
      let allDistricts: LocationNode[] = [];
      for (const prov of this.tree) {
        if (prov.children) {
          allDistricts = allDistricts.concat(prov.children.map(({ children, ...rest }) => rest as LocationNode));
        }
      }
      return this.filterByQuery(allDistricts, query.q);
    }

    const province = this.tree.find((p) => p.slug === query.p || p.id === query.p);
    if (!province || !province.children) {
      return [];
    }

    const districts = province.children.map(({ children, ...rest }) => rest);
    return this.filterByQuery(districts as LocationNode[], query.q);
  }

  getSectors(query: RwandaLocationQueryDto) {
    let districts: LocationNode[] = [];
    
    if (query.p) {
      const province = this.tree.find((p) => p.slug === query.p || p.id === query.p);
      if (province && province.children) {
        districts = province.children;
      }
    } else {
      for (const prov of this.tree) {
        if (prov.children) {
          districts = districts.concat(prov.children);
        }
      }
    }

    if (query.d) {
      districts = districts.filter(d => d.slug === query.d || d.id === query.d);
    }

    let allSectors: LocationNode[] = [];
    for (const dist of districts) {
      if (dist.children) {
        allSectors = allSectors.concat(dist.children.map(({ children, ...rest }) => rest as LocationNode));
      }
    }

    return this.filterByQuery(allSectors, query.q);
  }

  getCells(query: RwandaLocationQueryDto) {
    let districts: LocationNode[] = [];
    if (query.p) {
      const province = this.tree.find((p) => p.slug === query.p || p.id === query.p);
      if (province && province.children) {
        districts = province.children;
      }
    } else {
      for (const prov of this.tree) {
        if (prov.children) {
          districts = districts.concat(prov.children);
        }
      }
    }

    if (query.d) {
      districts = districts.filter(d => d.slug === query.d || d.id === query.d);
    }

    let sectors: LocationNode[] = [];
    for (const dist of districts) {
      if (dist.children) {
        sectors = sectors.concat(dist.children);
      }
    }

    if (query.s) {
      sectors = sectors.filter(s => s.slug === query.s || s.id === query.s);
    }

    let allCells: LocationNode[] = [];
    for (const sect of sectors) {
      if (sect.children) {
        allCells = allCells.concat(sect.children.map(({ children, ...rest }) => rest as LocationNode));
      }
    }

    return this.filterByQuery(allCells, query.q);
  }

  getVillages(query: RwandaLocationQueryDto) {
    let districts: LocationNode[] = [];
    if (query.p) {
      const province = this.tree.find((p) => p.slug === query.p || p.id === query.p);
      if (province && province.children) {
        districts = province.children;
      }
    } else {
      for (const prov of this.tree) {
        if (prov.children) {
          districts = districts.concat(prov.children);
        }
      }
    }

    if (query.d) {
      districts = districts.filter(d => d.slug === query.d || d.id === query.d);
    }

    let sectors: LocationNode[] = [];
    for (const dist of districts) {
      if (dist.children) {
        sectors = sectors.concat(dist.children);
      }
    }

    if (query.s) {
      sectors = sectors.filter(s => s.slug === query.s || s.id === query.s);
    }

    let cells: LocationNode[] = [];
    for (const sect of sectors) {
      if (sect.children) {
        cells = cells.concat(sect.children);
      }
    }

    if (query.c) {
      cells = cells.filter(c => c.slug === query.c || c.id === query.c);
    }

    let allVillages: LocationNode[] = [];
    for (const cell of cells) {
      if (cell.children) {
        allVillages = allVillages.concat(cell.children.map(({ children, ...rest }) => rest as LocationNode));
      }
    }

    return this.filterByQuery(allVillages, query.q);
  }
}
