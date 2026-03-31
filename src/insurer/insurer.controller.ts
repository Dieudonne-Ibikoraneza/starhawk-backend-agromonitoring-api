import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InsurerService } from './insurer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../users/enums/role.enum';

@ApiTags('Insurer')
@ApiBearerAuth()
@Controller('insurer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.INSURER)
export class InsurerController {
  constructor(private readonly insurerService: InsurerService) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get insurer dashboard statistics' })
  @ApiResponse({ status: 200 })
  async getDashboardStats(@CurrentUser() user: any) {
    return this.insurerService.getDashboardStats(user.userId);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get insurer reports' })
  @ApiResponse({ status: 200 })
  async getReports(@CurrentUser() user: any) {
    return this.insurerService.getReports(user.userId);
  }
}
