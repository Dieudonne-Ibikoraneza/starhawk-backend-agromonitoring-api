import { ApiProperty } from '@nestjs/swagger';
import { CropType } from '../../farms/enums/crop-type.enum';
import { UserProfileResponseDto } from '../../users/dto/user-profile-response.dto';

export class PendingFarmResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: CropType })
  cropType: CropType;

  @ApiProperty()
  sowingDate: Date;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ type: UserProfileResponseDto })
  farmer: UserProfileResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

