import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PasswordService } from './services/password.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private passwordService: PasswordService,
  ) {}

  async login(loginDto: LoginRequestDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByPhoneNumber(
      loginDto.phoneNumber,
    );

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userDoc = user as any;
    const payload = {
      sub: user.phoneNumber,
      userId: userDoc._id.toString(),
      role: user.role,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      userId: userDoc._id.toString(),
      role: user.role,
      email: user.email,
      phoneNumber: user.phoneNumber,
      firstLoginRequired: user.firstLoginRequired,
    };
  }
}

