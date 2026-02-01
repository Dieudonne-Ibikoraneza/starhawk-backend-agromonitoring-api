import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
import { PoliciesRepository } from './policies.repository';
import { Policy, PolicySchema } from './schemas/policy.schema';
import { AssessmentsModule } from '../assessments/assessments.module';
import { FarmsModule } from '../farms/farms.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Policy.name, schema: PolicySchema }]),
    AssessmentsModule,
    FarmsModule,
    EmailModule,
    UsersModule,
  ],
  controllers: [PoliciesController],
  providers: [PoliciesService, PoliciesRepository],
  exports: [PoliciesService, PoliciesRepository],
})
export class PoliciesModule {}

