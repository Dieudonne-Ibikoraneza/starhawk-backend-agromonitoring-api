import { Controller, Get, Put, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UuidValidationPipe } from '../common/pipes/uuid-validation.pipe';

@ApiTags('Monitoring')
@ApiBearerAuth()
@Controller('monitoring')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('farms/:farmId')
  @ApiOperation({ summary: 'Get monitoring data for a farm' })
  @ApiResponse({ status: 200 })
  async getMonitoringData(@Param('farmId', UuidValidationPipe) farmId: string) {
    return this.monitoringService.getMonitoringData(farmId);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get alerts' })
  @ApiResponse({ status: 200 })
  async getAlerts() {
    return this.monitoringService.getAlerts();
  }

  @Get('alerts/:farmId')
  @ApiOperation({ summary: 'Get alerts for a specific farm' })
  @ApiResponse({ status: 200 })
  async getFarmAlerts(@Param('farmId', UuidValidationPipe) farmId: string) {
    return this.monitoringService.getAlerts(farmId);
  }

  @Put('alerts/:alertId/read')
  @ApiOperation({ summary: 'Mark alert as read' })
  @ApiResponse({ status: 200 })
  async markAlertAsRead(@Param('alertId', UuidValidationPipe) alertId: string) {
    return this.monitoringService.markAlertAsRead(alertId);
  }
}

