import { RwandaLocationTreeNode } from '../types/rwanda-location.types';

const createDistrict = (
  id: string,
  name: string,
  children: RwandaLocationTreeNode[] = [],
): RwandaLocationTreeNode => ({
  id,
  name,
  slug: id,
  level: 'district',
  children,
});

const createProvince = (
  id: string,
  name: string,
  districts: RwandaLocationTreeNode[],
): RwandaLocationTreeNode => ({
  id,
  name,
  slug: id,
  level: 'province',
  children: districts,
});

export const STATIC_RWANDA_LOCATION_TREE: RwandaLocationTreeNode[] = [
  createProvince('kigali', 'City of Kigali', [
    createDistrict('gasabo', 'Gasabo'),
    createDistrict('kicukiro', 'Kicukiro'),
    createDistrict('nyarugenge', 'Nyarugenge'),
  ]),
  createProvince('east', 'Eastern Province', [
    createDistrict('bugesera', 'Bugesera'),
    createDistrict('gatsibo', 'Gatsibo'),
    createDistrict('kayonza', 'Kayonza'),
    createDistrict('kirehe', 'Kirehe'),
    createDistrict('ngoma', 'Ngoma', [
      {
        id: 'kibungo',
        name: 'Kibungo',
        slug: 'kibungo',
        level: 'sector',
        children: [],
      } as RwandaLocationTreeNode,
    ]),
    createDistrict('nyagatare', 'Nyagatare'),
    createDistrict('rwamagana', 'Rwamagana'),
  ]),
  createProvince('north', 'Northern Province', [
    createDistrict('burera', 'Burera'),
    createDistrict('gakenke', 'Gakenke'),
    createDistrict('gicumbi', 'Gicumbi'),
    createDistrict('musanze', 'Musanze'),
    createDistrict('rulindo', 'Rulindo'),
  ]),
  createProvince('south', 'Southern Province', [
    createDistrict('gisagara', 'Gisagara'),
    createDistrict('huye', 'Huye'),
    createDistrict('kamonyi', 'Kamonyi'),
    createDistrict('muhanga', 'Muhanga'),
    createDistrict('nyamagabe', 'Nyamagabe'),
    createDistrict('nyanza', 'Nyanza'),
    createDistrict('nyaruguru', 'Nyaruguru'),
    createDistrict('ruhango', 'Ruhango'),
  ]),
  createProvince('west', 'Western Province', [
    createDistrict('karongi', 'Karongi'),
    createDistrict('ngororero', 'Ngororero'),
    createDistrict('nyabihu', 'Nyabihu'),
    createDistrict('nyamasheke', 'Nyamasheke'),
    createDistrict('rubavu', 'Rubavu'),
    createDistrict('rusizi', 'Rusizi'),
    createDistrict('rutsiro', 'Rutsiro'),
  ]),
];
