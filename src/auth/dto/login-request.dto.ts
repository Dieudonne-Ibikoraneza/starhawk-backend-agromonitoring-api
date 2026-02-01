import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ValidRwandanPhoneNumber } from '../../common/validation/valid-rwandan-phone-number.decorator';

export class LoginRequestDto {
  @ApiProperty({
    description: 'Phone number (Rwandan format: 072/073/078/079)',
    example: '0721234567',
  })
  @IsNotEmpty()
  @IsString()
  @ValidRwandanPhoneNumber()
  phoneNumber: string;

  @ApiProperty({ description: 'Password', example: 'SecurePassword123!' })
  @IsNotEmpty()
  @IsString()
  password: string;
}

