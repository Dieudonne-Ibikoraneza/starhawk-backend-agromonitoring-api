import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateClaimAssessmentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  visitDate?: Date;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  observations?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  damageArea?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  ndviBefore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  ndviAfter?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  weatherImpactAnalysis?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reportText?: string;
}

