import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectAssessmentDto {
  @ApiProperty({ description: 'Reason for rejecting the assessment' })
  @IsNotEmpty()
  @IsString()
  rejectionReason: string;
}

