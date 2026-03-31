import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InsurerController } from './insurer.controller';
import { InsurerService } from './insurer.service';
import { Claim, ClaimSchema } from '../claims/schemas/claim.schema';
import { Policy, PolicySchema } from '../policies/schemas/policy.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Claim.name, schema: ClaimSchema },
      { name: Policy.name, schema: PolicySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [InsurerController],
  providers: [InsurerService],
  exports: [InsurerService],
})
export class InsurerModule {}
