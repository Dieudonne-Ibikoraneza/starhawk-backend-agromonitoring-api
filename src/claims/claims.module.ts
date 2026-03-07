import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { ClaimsRepository } from './claims.repository';
import { ClaimAssessmentsRepository } from './claim-assessments.repository';
import { PayoutsRepository } from './payouts.repository';
import { DamageAnalysisService } from './services/damage-analysis.service';
import { Claim, ClaimSchema } from './schemas/claim.schema';
import { ClaimAssessment, ClaimAssessmentSchema } from './schemas/claim-assessment.schema';
import { Payout, PayoutSchema } from './schemas/payout.schema';
import { PoliciesModule } from '../policies/policies.module';
import { FarmsModule } from '../farms/farms.module';
import { AgromonitoringModule } from '../agromonitoring/agromonitoring.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Claim.name, schema: ClaimSchema },
      { name: ClaimAssessment.name, schema: ClaimAssessmentSchema },
      { name: Payout.name, schema: PayoutSchema },
    ]),
    PoliciesModule,
    FarmsModule,
    AgromonitoringModule,
    EmailModule,
    UsersModule,
  ],
  controllers: [ClaimsController],
  providers: [
    ClaimsService,
    ClaimsRepository,
    ClaimAssessmentsRepository,
    PayoutsRepository,
    DamageAnalysisService,
  ],
  exports: [ClaimsService, ClaimsRepository],
})
export class ClaimsModule {}
