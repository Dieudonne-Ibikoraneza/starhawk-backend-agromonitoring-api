import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, IsNumber, Min, Max } from 'class-validator';

export class UpdateAssessmentDto {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  observations?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  riskScore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reportText?: string;

  @ApiProperty({ required: false, description: 'Comprehensive assessment notes' })
  @IsOptional()
  @IsString()
  comprehensiveNotes?: string;
}

