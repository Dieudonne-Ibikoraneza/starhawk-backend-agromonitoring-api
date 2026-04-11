import { CropType } from '../enums/crop-type.enum';

export const CROP_HARVEST_DURATION_MONTHS: Record<CropType, number> = {
  [CropType.RICE]: 4,
  [CropType.MAIZE]: 3.5,
  [CropType.BEANS]: 3,
  [CropType.WHEAT]: 4,
  [CropType.SORGHUM]: 4,
  [CropType.POTATOES]: 3.5,
  [CropType.CASSAVA]: 9,
  [CropType.BANANAS]: 10,
  [CropType.COFFEE]: 9,
  [CropType.TEA]: 6,
  [CropType.OTHER]: 3,
};

export function getCropHarvestDurationMonths(cropType: CropType): number {
  return CROP_HARVEST_DURATION_MONTHS[cropType] ?? CROP_HARVEST_DURATION_MONTHS[CropType.OTHER];
}

export function getRequiredMonitoringCycles(cropType: CropType): number {
  // Monthly cycle recommendation: 1 monitoring per month until harvest.
  return Math.max(1, Math.ceil(getCropHarvestDurationMonths(cropType)));
}
