import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UploadFarmKmlDto {
  @ApiProperty({
    description: 'Farm name provided by assessor',
    example: 'Main Farm Field',
  })
  @IsNotEmpty()
  @IsString()
  name: string;
}


