import {
  Injectable,
  OnModuleInit,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersRepository } from './users.repository';
import { ProfilesRepository } from './profiles.repository';
import { PasswordService } from '../auth/services/password.service';
import { NidaService } from '../nida/nida.service';
import { EmailService } from '../email/email.service';
import { RegisterRequestDto } from './dto/register-request.dto';
import { UpdateUserRequestDto } from './dto/update-user-request.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { Role } from './enums/role.enum';
import { UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    private usersRepository: UsersRepository,
    private profilesRepository: ProfilesRepository,
    private passwordService: PasswordService,
    private nidaService: NidaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Bootstrap admin user on module initialization
    await this.bootstrapAdminUser();
  }

  /**
   * Get default password based on user role
   */
  private getDefaultPasswordByRole(role: Role): string {
    const defaultPasswords: Record<Role, string> = {
      [Role.ADMIN]: 'admin@123',
      [Role.INSURER]: 'insurer@123',
      [Role.ASSESSOR]: 'assessor@123',
      [Role.FARMER]: 'farmer@123',
      [Role.GOVERNMENT]: 'government@123',
    };
    return defaultPasswords[role] || 'default@123';
  }

  private async bootstrapAdminUser() {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    if (!adminEmail) {
      return; // Skip if admin email not configured
    }

    const existingAdmin = await this.usersRepository.findByEmail(adminEmail);
    if (existingAdmin) {
      return; // Admin already exists
    }

    const adminPhone = this.configService.get<string>('ADMIN_PHONE');
    const adminNationalId = this.configService.get<string>(
      'ADMIN_NATIONAL_ID',
    );
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD') || this.getDefaultPasswordByRole(Role.ADMIN);

    if (!adminPhone || !adminNationalId) {
      console.warn('Admin credentials not fully configured, skipping admin bootstrap');
      return;
    }

    const hashedPassword = await this.passwordService.hashPassword(
      adminPassword,
    );

    await this.usersRepository.create({
      email: adminEmail,
      phoneNumber: adminPhone,
      nationalId: adminNationalId,
      password: hashedPassword,
      rawPassword: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
      active: true,
      firstLoginRequired: false,
      province: 'Kigali',
      district: 'Kigali',
      sector: 'Nyarugenge',
      cell: 'Nyamirambo',
      village: 'Nyamirambo',
    });

    console.log('Admin user created successfully');
  }

  async register(registerDto: RegisterRequestDto): Promise<UserProfileResponseDto> {
    // Check for duplicates
    const existingEmail = await this.usersRepository.findByEmail(
      registerDto.email,
    );
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingPhone = await this.usersRepository.findByPhoneNumber(
      registerDto.phoneNumber,
    );
    if (existingPhone) {
      throw new ConflictException('Phone number already exists');
    }

    const existingNationalId = await this.usersRepository.findByNationalId(
      registerDto.nationalId,
    );
    if (existingNationalId) {
      throw new ConflictException('National ID already exists');
    }

    // Verify with NIDA API
    const nidaResponse = await this.nidaService.verifyDocument(
      registerDto.nationalId,
    );

    if (!nidaResponse.data) {
      throw new ConflictException('NIDA verification failed');
    }

    const nidaData = nidaResponse.data;

    // Generate secure random password for the user
    const randomPassword = this.passwordService.generateSecurePassword();
    const hashedPassword = await this.passwordService.hashPassword(
      randomPassword,
    );

    // Map sex from NIDA (7=Female, 8=Male)
    const sex = nidaData.sex === '7' ? 'Female' : 'Male';

    // Create user with NIDA data
    const userData = {
      email: registerDto.email,
      phoneNumber: registerDto.phoneNumber,
      nationalId: registerDto.nationalId,
      password: hashedPassword,
      rawPassword: randomPassword, // Store raw password for reference
      firstName: nidaData.foreName,
      lastName: nidaData.surnames,
      role: registerDto.role,
      active: true,
      firstLoginRequired: true,
      province: nidaData.province,
      district: nidaData.district,
      sector: nidaData.sector,
      cell: nidaData.cell,
      village: nidaData.village,
      sex,
    };

    const user = await this.usersRepository.create(userData);

    // Create role-specific profile
    await this.createRoleProfile((user as any)._id.toString(), registerDto.role);

    // Send welcome email with random password (non-blocking)
    this.emailService
      .sendWelcomeEmail(
        registerDto.email,
        userData.firstName,
        registerDto.phoneNumber,
        randomPassword,
      )
      .catch((error) => {
        // Log error but don't fail registration
        // Password is still set, user can request password reset if email fails
        console.error('Failed to send welcome email:', error);
      });

    return this.mapToUserProfileResponse(user);
  }

  private async createRoleProfile(userId: string, role: Role): Promise<void> {
    switch (role) {
      case Role.FARMER:
        await this.profilesRepository.createFarmerProfile(userId, {});
        break;
      case Role.ASSESSOR:
        await this.profilesRepository.createAssessorProfile(userId, {});
        break;
      case Role.INSURER:
        await this.profilesRepository.createInsurerProfile(userId, {});
        break;
      // ADMIN and GOVERNMENT don't have profiles
    }
  }

  async findAll(
    page: number = 0,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortDirection: 'asc' | 'desc' = 'desc',
  ) {
    return this.usersRepository.findAll(page, limit, sortBy, sortDirection);
  }

  async findAllAssessors(
    page: number = 0,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortDirection: 'asc' | 'desc' = 'desc',
  ) {
    const result = await this.usersRepository.findByRole(
      Role.ASSESSOR,
      page,
      limit,
      sortBy,
      sortDirection,
    );

    // Map each assessor to include their profile
    const items = await Promise.all(
      result.items.map((user) => this.mapToUserProfileResponse(user)),
    );

    return {
      ...result,
      items,
    };
  }

  async findById(id: string): Promise<UserProfileResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User', id);
    }
    return this.mapToUserProfileResponse(user);
  }

  async findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    return this.usersRepository.findByPhoneNumber(phoneNumber);
  }

  async update(id: string, updateDto: UpdateUserRequestDto) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User', id);
    }

    // Check email uniqueness if email is being updated
    if (updateDto.email && updateDto.email !== user.email) {
      const existingUser = await this.usersRepository.findByEmail(
        updateDto.email,
      );
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    const updatedUser = await this.usersRepository.update(id, updateDto);
    return this.mapToUserProfileResponse(updatedUser!);
  }

  async deactivate(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User', id);
    }

    if (user.role === Role.ADMIN) {
      throw new ConflictException('Cannot deactivate admin user');
    }

    await this.usersRepository.deactivate(id);
    return { message: 'User deactivated successfully' };
  }

  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User', userId);
    }
    return this.mapToUserProfileResponse(user);
  }

  async updateProfile(
    userId: string,
    role: Role,
    profileData: any,
  ): Promise<UserProfileResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User', userId);
    }

    switch (role) {
      case Role.FARMER:
        await this.profilesRepository.updateFarmerProfile(userId, profileData);
        break;
      case Role.ASSESSOR:
        await this.profilesRepository.updateAssessorProfile(userId, profileData);
        break;
      case Role.INSURER:
        await this.profilesRepository.updateInsurerProfile(userId, profileData);
        break;
    }

    return this.getProfile(userId);
  }

  private async mapToUserProfileResponse(
    user: UserDocument,
  ): Promise<UserProfileResponseDto> {
    const userDoc = user as any;
    const response: UserProfileResponseDto = {
      id: userDoc._id.toString(),
      email: user.email,
      phoneNumber: user.phoneNumber,
      nationalId: user.nationalId,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      active: user.active,
      firstLoginRequired: user.firstLoginRequired,
      province: user.province,
      district: user.district,
      sector: user.sector,
      cell: user.cell,
      village: user.village,
      sex: user.sex,
      createdAt: userDoc.createdAt,
      updatedAt: userDoc.updatedAt,
    };

    // Load role-specific profile
    switch (user.role) {
      case Role.FARMER:
        const farmerProfile =
          await this.profilesRepository.findFarmerProfileByUserId(
            userDoc._id.toString(),
          );
        if (farmerProfile) {
          response.farmerProfile = {
            farmProvince: farmerProfile.farmProvince,
            farmDistrict: farmerProfile.farmDistrict,
            farmSector: farmerProfile.farmSector,
            farmCell: farmerProfile.farmCell,
            farmVillage: farmerProfile.farmVillage,
          };
        }
        break;
      case Role.ASSESSOR:
        const assessorProfile =
          await this.profilesRepository.findAssessorProfileByUserId(
            userDoc._id.toString(),
          );
        if (assessorProfile) {
          response.assessorProfile = {
            specialization: assessorProfile.specialization,
            experienceYears: assessorProfile.experienceYears,
            profilePhotoUrl: assessorProfile.profilePhotoUrl,
            bio: assessorProfile.bio,
            address: assessorProfile.address,
          };
        }
        break;
      case Role.INSURER:
        const insurerProfile =
          await this.profilesRepository.findInsurerProfileByUserId(
            userDoc._id.toString(),
          );
        if (insurerProfile) {
          response.insurerProfile = {
            companyName: insurerProfile.companyName,
            contactPerson: insurerProfile.contactPerson,
            website: insurerProfile.website,
            address: insurerProfile.address,
            companyDescription: insurerProfile.companyDescription,
            licenseNumber: insurerProfile.licenseNumber,
            registrationDate: insurerProfile.registrationDate,
            companyLogoUrl: insurerProfile.companyLogoUrl,
          };
        }
        break;
    }

    return response;
  }
}

