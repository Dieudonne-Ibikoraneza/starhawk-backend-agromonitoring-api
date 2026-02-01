import { ApiProperty } from '@nestjs/swagger';
import { UserProfileResponseDto } from '../../users/dto/user-profile-response.dto';
import { FarmResponseDto } from '../../farms/dto/farm-response.dto';

export class FarmerWithFarmsResponseDto extends UserProfileResponseDto {
  @ApiProperty({ type: [FarmResponseDto] })
  farms: FarmResponseDto[];
}

