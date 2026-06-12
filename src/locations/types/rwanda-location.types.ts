export type RwandaLocationLevel =
  | 'province'
  | 'district'
  | 'sector'
  | 'cell'
  | 'village';

export interface RwandaLocationNode {
  id: string;
  name: string;
  slug: string;
  level: RwandaLocationLevel;
  parentId?: string;
  parentSlug?: string;
}

export interface RwandaLocationTreeNode extends RwandaLocationNode {
  children?: RwandaLocationTreeNode[];
}

