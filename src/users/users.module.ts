import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { ProfilesRepository } from './profiles.repository';
import { User, UserSchema } from './schemas/user.schema';
import { FarmerProfile, FarmerProfileSchema } from './schemas/farmer-profile.schema';
import {
  AssessorProfile,
  AssessorProfileSchema,
} from './schemas/assessor-profile.schema';
import {
  InsurerProfile,
  InsurerProfileSchema,
} from './schemas/insurer-profile.schema';
import { AuthModule } from '../auth/auth.module';
import { NidaModule } from '../nida/nida.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: FarmerProfile.name, schema: FarmerProfileSchema },
      { name: AssessorProfile.name, schema: AssessorProfileSchema },
      { name: InsurerProfile.name, schema: InsurerProfileSchema },
    ]),
    forwardRef(() => AuthModule),
    NidaModule,
    EmailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, ProfilesRepository],
  exports: [UsersService, UsersRepository, ProfilesRepository],
})
export class UsersModule {}
