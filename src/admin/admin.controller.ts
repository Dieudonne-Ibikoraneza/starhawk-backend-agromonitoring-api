import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('statistics')
  @ApiOperation({ summary: 'Get system statistics (Admin only)' })
  @ApiResponse({ status: 200 })
  async getSystemStatistics() {
    return this.adminService.getSystemStatistics();
  }

  @Get('policies/overview')
  @ApiOperation({ summary: 'Get policy overview (Admin only)' })
  @ApiResponse({ status: 200 })
  async getPolicyOverview() {
    return this.adminService.getPolicyOverview();
  }

  @Get('claims/statistics')
  @ApiOperation({ summary: 'Get claim statistics (Admin only)' })
  @ApiResponse({ status: 200 })
  async getClaimStatistics() {
    return this.adminService.getClaimStatistics();
  }
}

