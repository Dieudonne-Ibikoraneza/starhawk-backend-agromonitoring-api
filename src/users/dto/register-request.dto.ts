import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../enums/role.enum';
import { ValidRwandaId } from '../../common/validation/valid-rwanda-id.decorator';
import { ValidRwandanPhoneNumber } from '../../common/validation/valid-rwandan-phone-number.decorator';
import { ValidEnum } from '../../common/validation/valid-enum.decorator';
import { GovernmentProfileDto } from './government-profile.dto';

export class RegisterRequestDto {
  @ApiProperty({
    description: 'National ID (16 digits, Rwanda format)',
    example: '1199012345678901',
  })
  @IsNotEmpty()
  @IsString()
  @ValidRwandaId()
  nationalId: string;

  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Phone number (Rwandan format: 072/073/078/079)',
    example: '0721234567',
  })
  @IsNotEmpty()
  @IsString()
  @ValidRwandanPhoneNumber()
  phoneNumber: string;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.FARMER,
  })
  @IsNotEmpty()
  @IsEnum(Role)
  @ValidEnum(Role)
  role: Role;

  @ApiPropertyOptional({
    description: 'Government hierarchy details for government staff accounts',
    type: GovernmentProfileDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GovernmentProfileDto)
  governmentProfile?: GovernmentProfileDto;
}

