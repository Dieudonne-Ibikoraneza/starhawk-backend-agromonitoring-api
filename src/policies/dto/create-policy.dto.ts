import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePolicyDto {
  @ApiProperty({ description: 'Assessment ID' })
  @IsNotEmpty()
  @IsString()
  assessmentId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverageLevel?: string;

  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  endDate: Date;
}

