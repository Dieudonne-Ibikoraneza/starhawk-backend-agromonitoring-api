import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { LossEventType } from '../enums/loss-event-type.enum';

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

  @ApiProperty({ required: false, type: [String], description: 'Photo URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  damagePhotos?: string[];
}

