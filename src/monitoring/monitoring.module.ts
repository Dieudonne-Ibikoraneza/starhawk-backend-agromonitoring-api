import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MonitoringRepository } from './monitoring.repository';
import { AlertsRepository } from './alerts.repository';
import {
  MonitoringRecord,
  MonitoringRecordSchema,
} from './schemas/monitoring-record.schema';
import { Alert, AlertSchema } from './schemas/alert.schema';
import {
  CropMonitoring,
  CropMonitoringSchema,
} from './schemas/crop-monitoring.schema';
import { PoliciesModule } from '../policies/policies.module';
import { FarmsModule } from '../farms/farms.module';
import { AgromonitoringModule } from '../agromonitoring/agromonitoring.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { CropMonitoringRepository } from './crop-monitoring.repository';
import { CropMonitoringService } from './crop-monitoring.service';
import { CropMonitoringController } from './crop-monitoring.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MonitoringRecord.name, schema: MonitoringRecordSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: CropMonitoring.name, schema: CropMonitoringSchema },
    ]),
    PoliciesModule,
    FarmsModule,
    AgromonitoringModule,
    EmailModule,
    UsersModule,
  ],
  controllers: [MonitoringController, CropMonitoringController],
  providers: [
    MonitoringService,
    MonitoringRepository,
    AlertsRepository,
    CropMonitoringRepository,
    CropMonitoringService,
  ],
  exports: [MonitoringService, CropMonitoringService],
})
export class MonitoringModule {}

