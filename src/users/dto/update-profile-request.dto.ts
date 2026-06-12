import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { GovernmentProfileDto, UpdateGovernmentProfileDto } from './government-profile.dto';

export class UpdateFarmerProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  farmProvince?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  farmDistrict?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  farmSector?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  farmCell?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  farmVillage?: string;
}

export class UpdateAssessorProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  experienceYears?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateInsurerProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyDescription?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  registrationDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyLogoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profilePictureUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cell?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  village?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  officialEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  officialPhone?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  specializations?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  socialMedia?: {
    twitter?: string;
    linkedin?: string;
    facebook?: string;
    instagram?: string;
  };
}

export { GovernmentProfileDto, UpdateGovernmentProfileDto };

