import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FlagAssessmentDto {
  @ApiProperty({ description: 'Reason for flagging the assessment for correction' })
  @IsNotEmpty()
  @IsString()
  correctionReason: string;
}
