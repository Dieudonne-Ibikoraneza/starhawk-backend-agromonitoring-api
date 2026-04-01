import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { CropMonitoringRepository } from './crop-monitoring.repository';
import { PoliciesRepository } from '../policies/policies.repository';
import { FarmsRepository } from '../farms/farms.repository';
import { UsersRepository } from '../users/users.repository';
import { AgromonitoringService } from '../agromonitoring/agromonitoring.service';
import { EmailService } from '../email/email.service';
import { CropMonitoringStatus } from './schemas/crop-monitoring.schema';
import { Types } from 'mongoose';
import { DroneAnalysisService } from '../assessments/services/drone-analysis.service';
import { PdfType } from '../assessments/dto/upload-drone-analysis.dto';

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
    private droneAnalysisService: DroneAnalysisService,
  ) {}

  /**
   * Start a new crop monitoring cycle
   * Validates max 2 cycles per policy
   */
  async startMonitoring(assessorId: string, policyId: string): Promise<any> {
    // Validate policy exists
    this.logger.log(`Looking up policy: ${policyId}`);
    const policy = await this.policiesRepository.findById(policyId);
    this.logger.debug(
      `Policy lookup result: ${JSON.stringify(
        {
          policyId,
          found: !!policy,
          status: policy?.status,
        },
        null,
        2,
      )}`,
    );

    if (!policy) {
      throw new NotFoundException('Policy', policyId);
    }

    // Validate policy is active
    if (policy.status !== 'ACTIVE') {
      throw new BadRequestException('Policy is not active');
    }

    // Check existing monitoring cycles for this policy
    this.logger.log(`Checking existing monitoring cycles for policy: ${policyId}`);
    const existingCount = await this.cropMonitoringRepository.countByPolicyId(policyId);
    this.logger.debug(`Existing monitoring cycles count: ${existingCount}`);

    if (existingCount >= 2) {
      throw new BadRequestException('Maximum 2 monitoring cycles allowed per policy');
    }

    // Determine monitoring number (1 or 2)
    const monitoringNumber = existingCount + 1;

    // Resolve farm ID (handle populated vs. unpopulated references)
    const resolvedFarmId = this.extractId(policy.farmId);

    // Get farm for AGROmonitoring data
    const farm = await this.farmsRepository.findById(resolvedFarmId);
    if (!farm) {
      throw new NotFoundException('Farm', this.extractId(policy.farmId));
    }

    // Fetch weather data from AGROmonitoring (if coordinates available)
    let weatherData: object | undefined = undefined;
    if (farm.location && farm.location.coordinates) {
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
      farmId: new Types.ObjectId(resolvedFarmId),
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
      notes?: string;
      ndviData?: object;
    },
  ): Promise<any> {
    // Validate monitoring exists and belongs to assessor
    const monitoring = await this.cropMonitoringRepository.findById(monitoringId);
    if (!monitoring) {
      throw new NotFoundException('CropMonitoring', monitoringId);
    }

    if (this.extractId(monitoring.assessorId) !== assessorId) {
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

    if (this.extractId(monitoring.assessorId) !== assessorId) {
      throw new BadRequestException('Crop monitoring does not belong to this assessor');
    }

    // Validate monitoring is in progress
    if (monitoring.status !== CropMonitoringStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot generate report. Current status: ${monitoring.status}`);
    }

    // Validate required fields
    const missingFields: string[] = [];

    if (!monitoring.notes || monitoring.notes.trim() === '') {
      missingFields.push('Notes (Assessor notes are required)');
    }

    // Validate that at least one drone report is uploaded and processed
    const uploadedPdfs = monitoring.droneAnalysisPdfs || [];
    if (uploadedPdfs.length === 0) {
      missingFields.push('Drone Analysis Report (At least one report is required)');
    } else {
      // Check if anyway uploaded PDFs have extraction failures
      const pdfsWithoutData = uploadedPdfs.filter((pdf: any) => !pdf.droneAnalysisData);
      if (pdfsWithoutData.length > 0) {
        const pdfTypes = pdfsWithoutData.map((pdf: any) => pdf.pdfType.replace('_', ' ')).join(', ');
        missingFields.push(`Data extraction for ${pdfTypes} report(s)`);
      }
    }

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Cannot generate report. Missing required fields or processed data: ${missingFields.join(', ')}`,
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
      const policy = await this.policiesRepository.findById(this.extractId(monitoring.policyId));
      if (policy) {
        const insurer = await this.usersRepository.findById(this.extractId(policy.insurerId));
        if (insurer) {
          const farm = await this.farmsRepository.findById(this.extractId(monitoring.farmId));
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

    return {
      monitoringId,
      policyId: monitoring.policyId,
      monitoringNumber: monitoring.monitoringNumber,
      monitoringDate: monitoring.monitoringDate,
      weatherData: monitoring.weatherData,
      ndviData: monitoring.ndviData,
      observations: monitoring.observations,
      notes: monitoring.notes,
      droneAnalysisPdfs: monitoring.droneAnalysisPdfs || [],
      reportGenerated: true,
      reportGeneratedAt: new Date(),
      status: CropMonitoringStatus.COMPLETED,
    };
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

  /** All cycles — admin dashboard */
  async getAllMonitoringRecordsForAdmin() {
    return this.cropMonitoringRepository.findAll();
  }

  /** Single cycle — admin detail view */
  async getMonitoringByIdForAdmin(id: string) {
    const monitoring = await this.cropMonitoringRepository.findById(id);
    if (!monitoring) {
      throw new NotFoundException('CropMonitoring', id);
    }
    return monitoring;
  }

  /**
   * Upload drone analysis PDF for crop monitoring
   */
  async uploadDroneAnalysis(
    assessorId: string,
    monitoringId: string,
    pdfFile: Express.Multer.File,
    pdfType: PdfType,
  ): Promise<any> {
    const monitoring = await this.cropMonitoringRepository.findById(monitoringId);
    if (!monitoring) {
      throw new NotFoundException('CropMonitoring', monitoringId);
    }

    if (this.extractId(monitoring.assessorId) !== assessorId) {
      throw new BadRequestException('Crop monitoring does not belong to this assessor');
    }

    if (pdfFile.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const existingPdfs = monitoring.droneAnalysisPdfs || [];
    const existingPdf = existingPdfs.find((pdf: any) => pdf.pdfType === pdfType);
    if (existingPdf) {
      throw new BadRequestException(
        `A ${pdfType.replace('_', ' ')} PDF has already been uploaded for this monitoring cycle`,
      );
    }

    if (!pdfFile.path && !pdfFile.buffer) {
      throw new BadRequestException('File data is missing - no path or buffer available');
    }

    const fs = require('fs');
    const path = require('path');
    const uploadDir = './uploads/drone-analysis';

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const filename = `${pdfType}-monitoring-${monitoringId}-${timestamp}-${randomStr}.pdf`;
    const filePath = path.join(uploadDir, filename);

    if (pdfFile.path) {
      if (fs.existsSync(pdfFile.path)) {
        fs.renameSync(pdfFile.path, filePath);
      } else {
        throw new BadRequestException('Uploaded file not found on disk');
      }
    } else if (pdfFile.buffer) {
      fs.writeFileSync(filePath, pdfFile.buffer);
    } else {
      throw new BadRequestException('Unable to process file - no path or buffer available');
    }

    const pdfUrl = `/uploads/drone-analysis/${filename}`;
    const absoluteFilePath = path.resolve(filePath);

    let droneAnalysisData = null;
    try {
      this.logger.log(`Calling drone analysis service for: ${absoluteFilePath}`);
      const analysisResult = await this.droneAnalysisService.extractDroneData(absoluteFilePath);
      
      if (analysisResult.success && analysisResult.extractedData) {
        droneAnalysisData = analysisResult.extractedData;
        this.logger.log('Successfully extracted drone data');
      } else {
        this.logger.warn(`Drone data extraction failed: ${analysisResult.error}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to extract drone data: ${error.message}`);
    }

    const newPdfEntry = {
      pdfType,
      pdfUrl,
      droneAnalysisData,
      uploadedAt: new Date(),
    };

    const updatedPdfs = [...existingPdfs, newPdfEntry];
    const updatedMonitoring = await this.cropMonitoringRepository.update(monitoringId, {
      droneAnalysisPdfs: updatedPdfs,
    });

    return {
      monitoringId,
      pdfType,
      pdfUrl,
      droneAnalysisData,
      monitoring: updatedMonitoring,
    };
  }

  /**
   * Get all uploaded PDFs for a monitoring cycle
   */
  async getUploadedPdfs(monitoringId: string): Promise<any> {
    const monitoring = await this.cropMonitoringRepository.findById(monitoringId);
    if (!monitoring) {
      throw new NotFoundException('CropMonitoring', monitoringId);
    }
    return monitoring.droneAnalysisPdfs || [];
  }

  /**
   * Delete a specific PDF from a monitoring cycle
   */
  async deletePdf(assessorId: string, monitoringId: string, pdfType: PdfType): Promise<any> {
    const monitoring = await this.cropMonitoringRepository.findById(monitoringId);
    if (!monitoring) {
      throw new NotFoundException('CropMonitoring', monitoringId);
    }

    if (this.extractId(monitoring.assessorId) !== assessorId) {
      throw new BadRequestException('Crop monitoring does not belong to this assessor');
    }

    const existingPdfs = monitoring.droneAnalysisPdfs || [];
    const pdfIndex = existingPdfs.findIndex((pdf: any) => pdf.pdfType === pdfType);

    if (pdfIndex === -1) {
      throw new BadRequestException(
        `No ${pdfType.replace('_', ' ')} PDF found for this monitoring cycle`,
      );
    }

    const fs = require('fs');
    const path = require('path');
    const pdfToDelete = existingPdfs[pdfIndex];
    const filePath = path.join('.', pdfToDelete.pdfUrl);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const updatedPdfs = existingPdfs.filter((pdf: any) => pdf.pdfType !== pdfType);

    const updatedMonitoring = await this.cropMonitoringRepository.update(monitoringId, {
      droneAnalysisPdfs: updatedPdfs,
    });

    return {
      monitoringId,
      pdfType,
      message: `${pdfType.replace('_', ' ')} PDF deleted successfully`,
      monitoring: updatedMonitoring,
    };
  }

  private extractId(id: any): string {
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (id instanceof Types.ObjectId) return id.toString();
    return id._id ? id._id.toString() : id.toString();
  }
}
