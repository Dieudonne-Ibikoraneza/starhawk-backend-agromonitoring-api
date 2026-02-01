import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAssessmentDto {
  @ApiProperty({ description: 'Farm ID' })
  @IsNotEmpty()
  @IsString()
  farmId: string;

  @ApiProperty({ description: 'Assessor ID' })
  @IsNotEmpty()
  @IsString()
  assessorId: string;
}

