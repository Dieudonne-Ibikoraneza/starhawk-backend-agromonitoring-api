import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateInsuranceRequestDto {
  @ApiProperty({ 
    description: 'Farm ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsNotEmpty({ message: 'Farm ID is required' })
  @IsString({ message: 'Farm ID must be a string' })
  farmId: string;

  @ApiProperty({ 
    required: false, 
    description: 'Additional notes',
    example: 'Requesting insurance coverage for my maize field'
  })
  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  notes?: string;
}

