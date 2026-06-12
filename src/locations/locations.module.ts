import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

import { JsonRwandaLocationSource } from './services/json-rwanda-location.source';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService, JsonRwandaLocationSource],
  exports: [LocationsService],
})
export class LocationsModule {}
