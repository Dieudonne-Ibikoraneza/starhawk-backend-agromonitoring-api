import { Injectable } from '@nestjs/common';
import { EosdaService } from '../../eosda/eosda.service';
import { FarmsRepository } from '../../farms/farms.repository';

@Injectable()
export class DamageAnalysisService {
  constructor(
    private eosdaService: EosdaService,
    private farmsRepository: FarmsRepository,
  ) {}

  async analyzeDamage(
    farmId: string,
    eventDate: Date,
  ): Promise<{
    ndviBefore: number;
    ndviAfter: number;
    damagePercentage: number;
    estimatedDamageArea: number;
  }> {
    const farm = await this.farmsRepository.findById(farmId);
    if (!farm || !farm.eosdaFieldId) {
      throw new Error('Farm not found or not linked to EOSDA field');
    }

    // Calculate date range for before (30 days before event) and after (7 days after)
    const beforeStartDate = new Date(eventDate);
    beforeStartDate.setDate(beforeStartDate.getDate() - 30);
    const beforeEndDate = new Date(eventDate);
    beforeEndDate.setDate(beforeEndDate.getDate() - 1);

    const afterStartDate = new Date(eventDate);
    const afterEndDate = new Date(eventDate);
    afterEndDate.setDate(afterEndDate.getDate() + 7);

    // Get NDVI before event
    const ndviBeforeData = await this.eosdaService.statistics.getNDVITimeSeries(
      {
        fieldId: farm.eosdaFieldId,
        startDate: beforeStartDate.toISOString().split('T')[0],
        endDate: beforeEndDate.toISOString().split('T')[0],
      },
    );

    // Get NDVI after event
    const ndviAfterData = await this.eosdaService.statistics.getNDVITimeSeries({
      fieldId: farm.eosdaFieldId,
      startDate: afterStartDate.toISOString().split('T')[0],
      endDate: afterEndDate.toISOString().split('T')[0],
    });

    // Calculate average NDVI before and after
    const beforeValues =
      ndviBeforeData.indices.NDVI?.map((d) => d.value) || [];
    const afterValues = ndviAfterData.indices.NDVI?.map((d) => d.value) || [];

    const ndviBefore =
      beforeValues.length > 0
        ? beforeValues.reduce((a, b) => a + b, 0) / beforeValues.length
        : 0.5;
    const ndviAfter =
      afterValues.length > 0
        ? afterValues.reduce((a, b) => a + b, 0) / afterValues.length
        : 0.3;

    // Calculate damage percentage
    const damagePercentage = Math.max(
      0,
      Math.min(100, ((ndviBefore - ndviAfter) / ndviBefore) * 100),
    );

    // Estimate damage area (simple calculation based on damage percentage)
    const estimatedDamageArea = ((farm.area || 0) * damagePercentage) / 100;

    return {
      ndviBefore,
      ndviAfter,
      damagePercentage,
      estimatedDamageArea,
    };
  }

  async getHistoricalComparison(
    farmId: string,
    eventDate: Date,
  ): Promise<{
    beforeImageUrl: string;
    afterImageUrl: string;
  }> {
    const farm = await this.farmsRepository.findById(farmId);
    if (!farm || !farm.eosdaFieldId) {
      throw new Error('Farm not found or not linked to EOSDA field');
    }

    // Get imagery before and after using scene search
    const beforeDate = new Date(eventDate);
    beforeDate.setDate(beforeDate.getDate() - 7);
    const afterDate = new Date(eventDate);
    afterDate.setDate(afterDate.getDate() + 7);

    // Search for scenes and get index images
    const [beforeScenes, afterScenes] = await Promise.all([
      this.eosdaService.fieldImagery.searchScenes({
        fieldId: farm.eosdaFieldId,
        dateStart: beforeDate.toISOString().split('T')[0],
        dateEnd: beforeDate.toISOString().split('T')[0],
        maxCloudCoverage: 20,
      }),
      this.eosdaService.fieldImagery.searchScenes({
        fieldId: farm.eosdaFieldId,
        dateStart: afterDate.toISOString().split('T')[0],
        dateEnd: afterDate.toISOString().split('T')[0],
        maxCloudCoverage: 20,
      }),
    ]);

    let beforeImageUrl = '';
    let afterImageUrl = '';

    // Get images if scenes are available
    if (beforeScenes.result.length > 0) {
      const beforeImage = await this.eosdaService.fieldImagery.getFieldIndexImage({
        fieldId: farm.eosdaFieldId,
        viewId: beforeScenes.result[0].view_id,
        index: 'NDVI',
      });
      beforeImageUrl = beforeImage.image_url;
    }

    if (afterScenes.result.length > 0) {
      const afterImage = await this.eosdaService.fieldImagery.getFieldIndexImage({
        fieldId: farm.eosdaFieldId,
        viewId: afterScenes.result[0].view_id,
        index: 'NDVI',
      });
      afterImageUrl = afterImage.image_url;
    }

    return {
      beforeImageUrl,
      afterImageUrl,
    };
  }
}

