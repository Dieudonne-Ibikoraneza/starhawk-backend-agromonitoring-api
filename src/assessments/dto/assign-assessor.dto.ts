import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class AssignAssessorDto {
  @ApiProperty({ description: 'Farm ID to assign assessor to' })
  @IsNotEmpty()
  @IsString()
  farmId: string;

  @ApiProperty({ description: 'Assessor ID to assign' })
  @IsNotEmpty()
  @IsString()
  assessorId: string;

  @ApiProperty({
    description: 'Optional insurer ID to link assessment to insurer',
    required: false,
  })
  @IsOptional()
  @IsString()
  insurerId?: string;
}

