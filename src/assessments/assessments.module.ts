import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { AssessmentsRepository } from './assessments.repository';
import { Assessment, AssessmentSchema } from './schemas/assessment.schema';
import { RiskScoringService } from './services/risk-scoring.service';
import { DroneAnalysisService } from './services/drone-analysis.service';
import { FarmsModule } from '../farms/farms.module';
import { UsersModule } from '../users/users.module';
import { EosdaModule } from '../eosda/eosda.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Assessment.name, schema: AssessmentSchema },
    ]),
    HttpModule,
    forwardRef(() => FarmsModule),
    UsersModule,
    EosdaModule,
    EmailModule,
  ],
  controllers: [AssessmentsController],
  providers: [
    AssessmentsService,
    AssessmentsRepository,
    RiskScoringService,
    DroneAnalysisService,
  ],
  exports: [AssessmentsService, AssessmentsRepository, RiskScoringService],
})
export class AssessmentsModule {}

