import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { CropMonitoringRepository } from './crop-monitoring.repository';
import { PoliciesRepository } from '../policies/policies.repository';
import { FarmsRepository } from '../farms/farms.repository';
import { UsersRepository } from '../users/users.repository';
import { AgromonitoringService } from '../agromonitoring/agromonitoring.service';
import { EmailService } from '../email/email.service';
import { CropMonitoringStatus } from './schemas/crop-monitoring.schema';
import { Types } from 'mongoose';

@Injectable()
export class CropMonitoringService {
  private readonly logger = new Logger(CropMonitoringService.name);

  constructor(
    private cropMonitoringRepository: CropMonitoringRepository,
    private policiesRepository: PoliciesRepository,
    private farmsRepository: FarmsRepository,
    private usersRepository: UsersRepository,
    private agromonitoringService: AgromonitoringService,
    private emailService: EmailService,
  ) {}

  /**
   * Start a new crop monitoring cycle
   * Validates max 2 cycles per policy
   */
  async startMonitoring(assessorId: string, policyId: string): Promise<any> {
    // Validate policy exists
    const policy = await this.policiesRepository.findById(policyId);
    if (!policy) {
      throw new NotFoundException('Policy', policyId);
    }

    // Validate policy is active
    if (policy.status !== 'ACTIVE') {
      throw new BadRequestException('Policy is not active');
    }

    // Check existing monitoring cycles for this policy
    const existingCount = await this.cropMonitoringRepository.countByPolicyId(policyId);

    if (existingCount >= 2) {
      throw new BadRequestException('Maximum 2 monitoring cycles allowed per policy');
    }

    // Determine monitoring number (1 or 2)
    const monitoringNumber = existingCount + 1;

    // Get farm for AGROmonitoring data
    const farm = await this.farmsRepository.findById(policy.farmId.toString());
    if (!farm) {
      throw new NotFoundException('Farm', policy.farmId.toString());
    }

    // Fetch weather data from AGROmonitoring (if coordinates available)
    let weatherData: object | undefined = undefined;
    if (farm.eosdaFieldId && farm.location && farm.location.coordinates) {
      try {
        const [lon, lat] = farm.location.coordinates;
        const forecastResponse = await this.agromonitoringService.weather.getWeatherForecast(
          lat,
          lon,
        );
        if (forecastResponse) {
          weatherData = forecastResponse as object;
        }
      } catch (error: any) {
        this.logger.warn(`Failed to fetch weather data for farm ${farm._id}: ${error.message}`);
      }
    }

    // Create monitoring record
    const monitoring = await this.cropMonitoringRepository.create({
      policyId: new Types.ObjectId(policyId),
      farmId: new Types.ObjectId(policy.farmId.toString()),
      assessorId: new Types.ObjectId(assessorId),
      monitoringNumber,
      monitoringDate: new Date(),
      weatherData,
      status: CropMonitoringStatus.IN_PROGRESS,
    });

    this.logger.log(`Crop monitoring cycle ${monitoringNumber} started for policy ${policyId}`);

    return monitoring;
  }

  /**
   * Update crop monitoring data
   */
  async updateMonitoring(
    assessorId: string,
    monitoringId: string,
    updateData: {
      observations?: string[];
      photoUrls?: string[];
      notes?: string;
      ndviData?: object;
    },
  ): Promise<any> {
    // Validate monitoring exists and belongs to assessor
    const monitoring = await this.cropMonitoringRepository.findById(monitoringId);
    if (!monitoring) {
      throw new NotFoundException('CropMonitoring', monitoringId);
    }

    if (monitoring.assessorId.toString() !== assessorId) {
      throw new BadRequestException('Crop monitoring does not belong to this assessor');
    }

    // Validate monitoring is in progress
    if (monitoring.status !== CropMonitoringStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot update monitoring. Current status: ${monitoring.status}`,
      );
    }

    // Update monitoring
    const updated = await this.cropMonitoringRepository.update(monitoringId, updateData);

    return updated;
  }

  /**
   * Generate monitoring report
   * Validates completeness and sends to insurer
   */
  async generateMonitoringReport(assessorId: string, monitoringId: string): Promise<any> {
    // Validate monitoring exists and belongs to assessor
    const monitoring = await this.cropMonitoringRepository.findById(monitoringId);
    if (!monitoring) {
      throw new NotFoundException('CropMonitoring', monitoringId);
    }

    if (monitoring.assessorId.toString() !== assessorId) {
      throw new BadRequestException('Crop monitoring does not belong to this assessor');
    }

    // Validate monitoring is in progress
    if (monitoring.status !== CropMonitoringStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot generate report. Current status: ${monitoring.status}`);
    }

    // Validate required fields
    const missingFields: string[] = [];

    if (!monitoring.notes || monitoring.notes.trim() === '') {
      missingFields.push('Notes');
    }

    if (!monitoring.observations || monitoring.observations.length === 0) {
      missingFields.push('Observations');
    }

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Cannot generate report. Missing required fields: ${missingFields.join(', ')}`,
      );
    }

    // Check if report already generated
    if (monitoring.reportGenerated) {
      throw new BadRequestException('Report has already been generated');
    }

    // Update monitoring with report generation
    const updated = await this.cropMonitoringRepository.update(monitoringId, {
      reportGenerated: true,
      reportGeneratedAt: new Date(),
      status: CropMonitoringStatus.COMPLETED,
    });

    // Notify insurer
    try {
      const policy = await this.policiesRepository.findById(monitoring.policyId.toString());
      if (policy) {
        const insurer = await this.usersRepository.findById(policy.insurerId.toString());
        if (insurer) {
          const farm = await this.farmsRepository.findById(monitoring.farmId.toString());
          await this.emailService
            .sendMonitoringReportEmail(
              insurer.email,
              insurer.firstName,
              farm?.name || 'Farm',
              monitoringId,
              monitoring.monitoringNumber,
            )
            .catch(error => {
              this.logger.error(`Failed to send monitoring report email: ${error.message}`);
            });
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to notify insurer about monitoring report: ${error.message}`);
    }

    this.logger.log(`Monitoring report generated for monitoring ${monitoringId}`);

    return updated;
  }

  /**
   * Get all monitoring tasks for an assessor
   */
  async getAssessorMonitoringTasks(assessorId: string): Promise<any[]> {
    return this.cropMonitoringRepository.findByAssessorId(assessorId);
  }

  /**
   * Get all monitoring records for a policy
   */
  async getPolicyMonitoringRecords(policyId: string): Promise<any[]> {
    return this.cropMonitoringRepository.findByPolicyId(policyId);
  }
}
