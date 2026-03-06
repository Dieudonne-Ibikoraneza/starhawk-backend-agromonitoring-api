import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';
import { FarmsRepository } from './farms.repository';
import { InsuranceRequestsRepository } from './insurance-requests.repository';
import { ShapefileParserService } from './services/shapefile-parser.service';
import { LocationService } from './services/location.service';
import { EosdaModule } from '../eosda/eosda.module';
import { AssessmentsModule } from '../assessments/assessments.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { Farm, FarmSchema } from './schemas/farm.schema';
import {
  InsuranceRequest,
  InsuranceRequestSchema,
} from './schemas/insurance-request.schema';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 1048576, // 1MB
      },
    }),
    MongooseModule.forFeature([
      { name: Farm.name, schema: FarmSchema },
      { name: InsuranceRequest.name, schema: InsuranceRequestSchema },
    ]),
    EosdaModule,
    forwardRef(() => AssessmentsModule),
    EmailModule,
    UsersModule,
    HttpModule,
  ],
  controllers: [FarmsController],
  providers: [
    FarmsService,
    FarmsRepository,
    InsuranceRequestsRepository,
    ShapefileParserService,
    LocationService,
  ],
  exports: [FarmsService, FarmsRepository, LocationService],
})
export class FarmsModule {}

