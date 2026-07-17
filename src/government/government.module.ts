import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GovernmentController } from './government.controller';
import { GovernmentService } from './government.service';
import { Region, RegionSchema } from './schemas/region.schema';
import { DailyAggregation, DailyAggregationSchema } from './schemas/daily-aggregation.schema';
import { GovernmentProfile, GovernmentProfileSchema } from '../users/schemas/government-profile.schema';
import { FarmerProfile, FarmerProfileSchema } from '../users/schemas/farmer-profile.schema';
import { Farm, FarmSchema } from '../farms/schemas/farm.schema';
import { Policy, PolicySchema } from '../policies/schemas/policy.schema';
import { Claim, ClaimSchema } from '../claims/schemas/claim.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { RegionAccessGuard } from './guards/region-access.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Region.name, schema: RegionSchema },
      { name: DailyAggregation.name, schema: DailyAggregationSchema },
      { name: GovernmentProfile.name, schema: GovernmentProfileSchema },
      { name: FarmerProfile.name, schema: FarmerProfileSchema },
      { name: Farm.name, schema: FarmSchema },
      { name: Policy.name, schema: PolicySchema },
      { name: Claim.name, schema: ClaimSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [GovernmentController],
  providers: [GovernmentService, RegionAccessGuard],
  exports: [GovernmentService],
})
export class GovernmentModule {}
