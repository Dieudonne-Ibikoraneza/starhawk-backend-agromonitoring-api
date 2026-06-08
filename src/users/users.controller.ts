import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from './enums/role.enum';
import { RegisterRequestDto } from './dto/register-request.dto';
import { UpdateUserRequestDto } from './dto/update-user-request.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { UuidValidationPipe } from '../common/pipes/uuid-validation.pipe';
import {
  UpdateFarmerProfileDto,
  UpdateAssessorProfileDto,
  UpdateInsurerProfileDto,
} from './dto/update-profile-request.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Register a new user (Admin only)' })
  @ApiResponse({ status: 201, type: UserProfileResponseDto })
  async register(
    @Body() registerDto: RegisterRequestDto,
  ): Promise<UserProfileResponseDto> {
    return this.usersService.register(registerDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all users (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortDirection', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200 })
  async findAll(
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(10), ParseIntPipe) size: number,
    @Query('sortBy', new DefaultValuePipe('createdAt')) sortBy: string,
    @Query('sortDirection', new DefaultValuePipe('desc')) sortDirection: 'asc' | 'desc',
  ) {
    return this.usersService.findAll(page, size, sortBy, sortDirection);
  }

  @Get('assessors')
  @UseGuards(RolesGuard)
  @Roles(Role.INSURER, Role.ADMIN)
  @ApiOperation({ summary: 'List all assessors (Insurer and Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortDirection', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200 })
  async findAllAssessors(
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(10), ParseIntPipe) size: number,
    @Query('sortBy', new DefaultValuePipe('createdAt')) sortBy: string,
    @Query('sortDirection', new DefaultValuePipe('desc')) sortDirection: 'asc' | 'desc',
  ) {
    return this.usersService.findAllAssessors(page, size, sortBy, sortDirection);
  }

  @Get('insurers')
  @ApiOperation({ summary: 'List all insurers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortDirection', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200 })
  async findAllInsurers(
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(10), ParseIntPipe) size: number,
    @Query('sortBy', new DefaultValuePipe('createdAt')) sortBy: string,
    @Query('sortDirection', new DefaultValuePipe('desc')) sortDirection: 'asc' | 'desc',
  ) {
    return this.usersService.findAllInsurers(page, size, sortBy, sortDirection);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  async getProfile(
    @CurrentUser() user: any,
  ): Promise<UserProfileResponseDto> {
    return this.usersService.getProfile(user.userId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  async findById(
    @Param('id', UuidValidationPipe) id: string,
  ): Promise<UserProfileResponseDto> {
    return this.usersService.findById(id);
  }

  @Post('profile/request-deactivation')
  @ApiOperation({ summary: 'Request account deactivation' })
  @ApiResponse({ status: 200 })
  async requestDeactivation(@CurrentUser() user: any) {
    return this.usersService.requestDeactivation(user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update own profile' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  async updateProfile(
    @CurrentUser() user: any,
    @Body()
    profileData:
      | UpdateFarmerProfileDto
      | UpdateAssessorProfileDto
      | UpdateInsurerProfileDto,
  ): Promise<UserProfileResponseDto> {
    return this.usersService.updateProfile(
      user.userId,
      user.role,
      profileData,
    );
  }

  @Post('profile/signature')
  @ApiOperation({ summary: 'Upload signature for profile' })
  @ApiResponse({ status: 200 })
  async uploadSignature(
    @CurrentUser() user: any,
    @Body('signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Signature is required');
    }
    return this.usersService.uploadSignature(user.userId, signature);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update user (Admin only)' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  async update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() updateDto: UpdateUserRequestDto,
  ): Promise<UserProfileResponseDto> {
    return this.usersService.update(id, updateDto);
  }

  @Get('insurers/:id/public')
  @ApiOperation({ summary: 'Get public profile of an insurer' })
  @ApiResponse({ status: 200 })
  async getInsurerPublicProfile(
    @Param('id', UuidValidationPipe) id: string,
  ) {
    return this.usersService.getInsurerPublicProfile(id);
  }

  @Get('assessors/:id/profile')
  @ApiOperation({ summary: 'Get detailed profile of an assessor' })
  @ApiResponse({ status: 200 })
  async getAssessorProfile(
    @Param('id', UuidValidationPipe) id: string,
  ) {
    return this.usersService.getAssessorProfile(id);
  }

  @Put(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate user (Admin only)' })
  @ApiResponse({ status: 200 })
  async deactivate(@Param('id', UuidValidationPipe) id: string) {
    return this.usersService.deactivate(id);
  }
}

