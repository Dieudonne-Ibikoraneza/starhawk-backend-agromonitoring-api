import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CropMonitoringService } from './crop-monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../users/enums/role.enum';
import { UuidValidationPipe } from '../common/pipes/uuid-validation.pipe';

@ApiTags('Crop Monitoring')
@ApiBearerAuth()
@Controller('crop-monitoring')
@UseGuards(JwtAuthGuard)
export class CropMonitoringController {
  constructor(
    private readonly cropMonitoringService: CropMonitoringService,
  ) {}

  @Post('start')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Start a new crop monitoring cycle (Assessor only)' })
  @ApiResponse({ status: 201 })
  async startMonitoring(
    @CurrentUser() user: any,
    @Body() body: { policyId: string },
  ) {
    return this.cropMonitoringService.startMonitoring(
      user.userId,
      body.policyId,
    );
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Update crop monitoring data (Assessor only)' })
  @ApiResponse({ status: 200 })
  async updateMonitoring(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body() updateData: {
      observations?: string[];
      photoUrls?: string[];
      notes?: string;
      ndviData?: object;
    },
  ) {
    return this.cropMonitoringService.updateMonitoring(
      user.userId,
      id,
      updateData,
    );
  }

  @Post(':id/generate-report')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({
    summary: 'Generate crop monitoring report (Assessor only)',
  })
  @ApiResponse({ status: 200 })
  async generateReport(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
  ) {
    return this.cropMonitoringService.generateMonitoringReport(
      user.userId,
      id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List crop monitoring tasks (role-based)' })
  @ApiResponse({ status: 200 })
  async getMonitoringTasks(@CurrentUser() user: any) {
    // ASSESSOR: See their monitoring tasks
    if (user.role === Role.ASSESSOR) {
      return this.cropMonitoringService.getAssessorMonitoringTasks(
        user.userId,
      );
    }
    // ADMIN/INSURER: See all (can be extended later)
    return [];
  }

  @Get('policy/:policyId')
  @ApiOperation({ summary: 'Get all monitoring records for a policy' })
  @ApiResponse({ status: 200 })
  async getPolicyMonitoring(
    @Param('policyId', UuidValidationPipe) policyId: string,
  ) {
    return this.cropMonitoringService.getPolicyMonitoringRecords(policyId);
  }
}

