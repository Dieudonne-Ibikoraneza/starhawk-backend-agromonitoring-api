import { Injectable } from '@nestjs/common';
import { AgromonitoringService } from '../../agromonitoring/agromonitoring.service';
import { FarmsRepository } from '../../farms/farms.repository';

@Injectable()
export class DamageAnalysisService {
  constructor(
    private agromonitoringService: AgromonitoringService,
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
      throw new Error('Farm not found or not linked to AGROmonitoring field');
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
    const ndviBeforeData = await this.agromonitoringService.fieldAnalytics.getNDVIData(
      {
        fieldId: farm.eosdaFieldId,
        start: beforeStartDate.toISOString().split('T')[0],
        end: beforeEndDate.toISOString().split('T')[0],
      },
    );

    // Get NDVI after event
    const ndviAfterData = await this.agromonitoringService.fieldAnalytics.getNDVIData({
      fieldId: farm.eosdaFieldId,
      start: afterStartDate.toISOString().split('T')[0],
      end: afterEndDate.toISOString().split('T')[0],
    });

    // Calculate average NDVI before and after
    // AGROmonitoring returns an array with ndvi property directly
    const beforeValues = ndviBeforeData.map((d: any) => d.ndvi).filter((v: any) => v !== null);
    const afterValues = ndviAfterData.map((d: any) => d.ndvi).filter((v: any) => v !== null);

    const ndviBefore =
      beforeValues.length > 0
        ? beforeValues.reduce((a: number, b: number) => a + b, 0) / beforeValues.length
        : 0.5;
    const ndviAfter =
      afterValues.length > 0
        ? afterValues.reduce((a: number, b: number) => a + b, 0) / afterValues.length
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
      throw new Error('Farm not found or not linked to AGROmonitoring field');
    }

    // Get imagery before and after using scene search
    const beforeDate = new Date(eventDate);
    beforeDate.setDate(beforeDate.getDate() - 7);
    const afterDate = new Date(eventDate);
    afterDate.setDate(afterDate.getDate() + 7);

    // Search for available imagery
    const [beforeScenes, afterScenes] = await Promise.all([
      this.agromonitoringService.fieldAnalytics.searchImagery({
        fieldId: farm.eosdaFieldId,
        start: beforeDate.toISOString().split('T')[0],
        end: beforeDate.toISOString().split('T')[0],
        clouds: 20,
      }),
      this.agromonitoringService.fieldAnalytics.searchImagery({
        fieldId: farm.eosdaFieldId,
        start: afterDate.toISOString().split('T')[0],
        end: afterDate.toISOString().split('T')[0],
        clouds: 20,
      }),
    ]);

    let beforeImageUrl = '';
    let afterImageUrl = '';

    // Get preview URLs if imagery is available
    // AGROmonitoring returns results array with preview_url
    if (beforeScenes.results && beforeScenes.results.length > 0) {
      beforeImageUrl = beforeScenes.results[0].preview_url || '';
    }

    if (afterScenes.results && afterScenes.results.length > 0) {
      afterImageUrl = afterScenes.results[0].preview_url || '';
    }

    return {
      beforeImageUrl,
      afterImageUrl,
    };
  }
}
