import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class StartMonitoringDto {
  @ApiProperty({
    description: 'ID of the policy to start monitoring for',
    example: '69bbbea52b3a324674220c08',
    required: true,
  })
  @IsMongoId()
  @IsNotEmpty()
  policyId: string;
}
