import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';

export class FarmerProfileDto {
  @ApiProperty()
  farmProvince?: string;

  @ApiProperty()
  farmDistrict?: string;

  @ApiProperty()
  farmSector?: string;

  @ApiProperty()
  farmCell?: string;

  @ApiProperty()
  farmVillage?: string;
}

export class AssessorProfileDto {
  @ApiProperty()
  specialization?: string;

  @ApiProperty()
  experienceYears?: number;

  @ApiProperty()
  profilePhotoUrl?: string;

  @ApiProperty()
  bio?: string;

  @ApiProperty()
  address?: string;
}

export class InsurerProfileDto {
  @ApiProperty()
  companyName?: string;

  @ApiProperty()
  contactPerson?: string;

  @ApiProperty()
  website?: string;

  @ApiProperty()
  address?: string;

  @ApiProperty()
  companyDescription?: string;

  @ApiProperty()
  licenseNumber?: string;

  @ApiProperty()
  registrationDate?: Date;

  @ApiProperty()
  companyLogoUrl?: string;
}

export class UserProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  nationalId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  firstLoginRequired: boolean;

  @ApiProperty({ required: false })
  province?: string;

  @ApiProperty({ required: false })
  district?: string;

  @ApiProperty({ required: false })
  sector?: string;

  @ApiProperty({ required: false })
  cell?: string;

  @ApiProperty({ required: false })
  village?: string;

  @ApiProperty({ required: false })
  sex?: string;

  @ApiProperty({ required: false })
  farmerProfile?: FarmerProfileDto;

  @ApiProperty({ required: false })
  assessorProfile?: AssessorProfileDto;

  @ApiProperty({ required: false })
  insurerProfile?: InsurerProfileDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

