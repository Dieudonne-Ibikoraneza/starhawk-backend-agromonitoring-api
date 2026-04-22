import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsDateString, IsOptional, IsString } from 'class-validator';
import { CropType } from '../enums/crop-type.enum';

export class CreateFarmSimpleDto {
  @ApiProperty({
    description: 'Crop type',
    enum: CropType,
    example: CropType.MAIZE,
  })
  @IsNotEmpty()
  @IsEnum(CropType)
  cropType: CropType;

  @ApiProperty({
    description: 'Sowing date in YYYY-MM-DD format',
    example: '2025-04-15',
  })
  @IsNotEmpty()
  @IsDateString()
  sowingDate: string;

  @ApiProperty({ description: 'Insurer ID chosen by the farmer', required: false })
  @IsOptional()
  @IsString()
  insurerId?: string;
}


