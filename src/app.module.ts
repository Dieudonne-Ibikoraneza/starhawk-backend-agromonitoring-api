import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NidaModule } from './nida/nida.module';
import { EmailModule } from './email/email.module';
import { FarmsModule } from './farms/farms.module';
import { EosdaModule } from './eosda/eosda.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { PoliciesModule } from './policies/policies.module';
import { ClaimsModule } from './claims/claims.module';
import { PhotosModule } from './photos/photos.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),

    // MongoDB connection
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost:27017/starhawk'),
      }),
    }),

    // Schedule module for cron jobs
    ScheduleModule.forRoot(),

    // Feature modules
    CommonModule,
    HealthModule,
    AuthModule,
    UsersModule,
    NidaModule,
    EmailModule,
    FarmsModule,
    EosdaModule,
    AssessmentsModule,
    PoliciesModule,
    ClaimsModule,
    PhotosModule,
    MonitoringModule,
    AdminModule,
  ],
})
export class AppModule {}

