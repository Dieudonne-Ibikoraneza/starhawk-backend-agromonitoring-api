import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { LossEventType } from '../enums/loss-event-type.enum';
import { ClaimType } from '../enums/claim-type.enum';

export class CreateClaimDto {
  @ApiProperty({ description: 'Policy ID' })
  @IsNotEmpty()
  @IsString()
  policyId: string;

  @ApiProperty({ enum: LossEventType })
  @IsNotEmpty()
  @IsEnum(LossEventType)
  lossEventType: LossEventType;

  @ApiProperty({ required: false, description: 'Loss description' })
  @IsOptional()
  @IsString()
  lossDescription?: string;

  @ApiProperty({ required: false, description: 'Loss description (alias)' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, type: [String], description: 'Photo URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  damagePhotos?: string[];

  @ApiProperty({ required: false, description: 'Loss event date' })
  @IsOptional()
  @IsString()
  lossEventDate?: string;

  @ApiProperty({ required: false, description: 'Loss event date (alias)' })
  @IsOptional()
  @IsString()
  eventDate?: string;

  @ApiProperty({ required: false, description: 'Estimated loss amount' })
  @IsOptional()
  estimatedLoss?: any;

  @ApiProperty({
    required: false,
    enum: ClaimType,
    default: ClaimType.FARMER_REPORTED_LOSS,
    description: 'Claim type. Farmer-created claims are always FARMER_REPORTED_LOSS.',
  })
  @IsOptional()
  @IsEnum(ClaimType)
  claimType?: ClaimType;
}

