import { Injectable, Logger } from '@nestjs/common';
import { FarmsRepository } from '../farms.repository';
import { LocationService } from './location.service';

/**
 * Persists reverse-geocoded location names on farm documents so reads do not
 * hit Nominatim on every request. Used for one-time backfill of legacy farms
 * that have coordinates but no stored locationName.
 */
@Injectable()
export class FarmLocationSyncService {
  private readonly logger = new Logger(FarmLocationSyncService.name);

  constructor(
    private readonly farmsRepository: FarmsRepository,
    private readonly locationService: LocationService,
  ) {}

  /**
   * If the farm has coordinates but no locationName, resolve via Nominatim once,
   * save to MongoDB, and set farm.locationName in memory for the current response.
   */
  async ensurePersisted(farm: any): Promise<void> {
    if (!farm?.location?.coordinates || farm.location.coordinates.length < 2) {
      return;
    }
    if (typeof farm.locationName === 'string' && farm.locationName.trim() !== '') {
      return;
    }

    const longitude = farm.location.coordinates[0];
    const latitude = farm.location.coordinates[1];

    try {
      const name = await this.locationService.getLocationString(latitude, longitude);
      await this.farmsRepository.update(farm._id.toString(), { locationName: name });
      farm.locationName = name;
    } catch (err: any) {
      this.logger.warn(
        `Failed to persist location name for farm ${farm._id}: ${err?.message ?? err}`,
      );
    }
  }
}
