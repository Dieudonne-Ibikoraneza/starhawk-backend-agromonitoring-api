import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CropType } from '../enums/crop-type.enum';

export class GeoJsonPointDto {
  @ApiProperty({ enum: ['Point'] })
  @IsNotEmpty()
  type: 'Point';

  @ApiProperty({ type: [Number], example: [30.0619, -1.9441] })
  @IsNotEmpty()
  coordinates: [number, number]; // [longitude, latitude]
}

export class GeoJsonPolygonDto {
  @ApiProperty({ enum: ['Polygon', 'MultiPolygon'] })
  @IsNotEmpty()
  type: 'Polygon' | 'MultiPolygon';

  @ApiProperty()
  @IsNotEmpty()
  coordinates: number[][][] | number[][][][];
}

export class CreateFarmDto {
  @ApiProperty({ description: 'Farm name', example: 'Main Farm' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Farm location (centroid) as GeoJSON Point',
    type: GeoJsonPointDto,
  })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => GeoJsonPointDto)
  location: GeoJsonPointDto;

  @ApiProperty({
    description: 'Farm boundary as GeoJSON Polygon or MultiPolygon',
    type: GeoJsonPolygonDto,
  })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => GeoJsonPolygonDto)
  boundary: GeoJsonPolygonDto;

  @ApiProperty({ enum: CropType, required: false })
  @IsOptional()
  @IsEnum(CropType)
  cropType?: CropType;
}

