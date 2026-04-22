import { Controller, Get, UseGuards, Param, Delete, Patch } from '@nestjs/common';
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
import { UsersService } from '../users/users.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
  ) {}

  @Get('statistics')
  @ApiOperation({ summary: 'Get system statistics (Admin only)' })
  @ApiResponse({ status: 200 })
  async getSystemStatistics() {
    return this.adminService.getSystemStatistics();
  }

  @Get('health')
  @ApiOperation({
    summary: 'System health (DB, AGROmonitoring, EOSDA field API, storage, process)',
  })
  @ApiResponse({ status: 200 })
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get('policies/list')
  @ApiOperation({ summary: 'List all policies (Admin only)' })
  @ApiResponse({ status: 200 })
  async getPoliciesList() {
    return this.adminService.getAllPoliciesList();
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

  @Delete('users/:id')
  @ApiOperation({ summary: 'Permanently delete a user (Admin only)' })
  @ApiResponse({ status: 200 })
  async permanentlyDeleteUser(@Param('id') id: string) {
    return this.usersService.permanentlyDeleteUser(id);
  }

  @Patch('users/:id/restore')
  @ApiOperation({ summary: 'Restore a deactivated user (Admin only)' })
  @ApiResponse({ status: 200 })
  async restoreUser(@Param('id') id: string) {
    return this.usersService.restoreUser(id);
  }
}

