import { IsString, MaxLength, MinLength } from 'class-validator';

export class FarmerRejectPolicyDto {
  @IsString()
  @MinLength(5, { message: 'Reason must be at least 5 characters.' })
  @MaxLength(2000)
  reason: string;
}
