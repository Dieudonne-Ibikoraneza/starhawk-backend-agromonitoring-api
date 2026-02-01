import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateFarmerProfileDto {
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
}

