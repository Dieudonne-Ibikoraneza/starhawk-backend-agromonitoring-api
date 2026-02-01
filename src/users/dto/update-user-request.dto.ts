import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEmail, IsEnum, IsBoolean } from 'class-validator';
import { Role } from '../enums/role.enum';

export class UpdateUserRequestDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

