import { ApiProperty } from '@nestjs/swagger';
import { FarmStatus } from '../enums/farm-status.enum';
import { CropType } from '../enums/crop-type.enum';

export class FarmResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  farmerId: string;

  @ApiProperty({ required: false })
  farmerName?: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  area?: number;

  @ApiProperty({ enum: CropType, required: false })
  cropType?: CropType;

  @ApiProperty({ required: false })
  sowingDate?: Date;

  @ApiProperty()
  location: {
    type: 'Point';
    coordinates: [number, number];
  };

  @ApiProperty({ required: false })
  locationName?: string;

  @ApiProperty()
  boundary: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };

  @ApiProperty({ enum: FarmStatus })
  status: FarmStatus;

  @ApiProperty({ required: false })
  shapefilePath?: string;

  @ApiProperty({ required: false })
  eosdaFieldId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

