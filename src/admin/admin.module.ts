import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { FarmsModule } from '../farms/farms.module';
import { PoliciesModule } from '../policies/policies.module';
import { ClaimsModule } from '../claims/claims.module';
import { AssessmentsModule } from '../assessments/assessments.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Farm, FarmSchema } from '../farms/schemas/farm.schema';
import { Policy, PolicySchema } from '../policies/schemas/policy.schema';
import { Claim, ClaimSchema } from '../claims/schemas/claim.schema';
import { Assessment, AssessmentSchema } from '../assessments/schemas/assessment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Farm.name, schema: FarmSchema },
      { name: Policy.name, schema: PolicySchema },
      { name: Claim.name, schema: ClaimSchema },
      { name: Assessment.name, schema: AssessmentSchema },
    ]),
    UsersModule,
    FarmsModule,
    PoliciesModule,
    ClaimsModule,
    AssessmentsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

