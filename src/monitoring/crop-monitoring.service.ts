import * as fs from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException, BadRequestException, Logger, InternalServerErrorException } from '@nestjs/common';
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
import { getRequiredMonitoringCycles } from '../farms/constants/crop-harvest-duration.constants';

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
   * Validates max cycles per policy based on crop type
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

    // Resolve farm ID (handle populated vs. unpopulated references)
    const resolvedFarmId = this.extractId(policy.farmId);

    // Get farm for AGROmonitoring data
    const farm = await this.farmsRepository.findById(resolvedFarmId);
    if (!farm) {
      throw new NotFoundException('Farm', this.extractId(policy.farmId));
    }

    // Find or create parent CropMonitoring record
    let parent = await this.cropMonitoringRepository.findParentByPolicyId(policyId);
    if (!parent) {
      this.logger.log(`Creating new parent CropMonitoring for policy ${policyId}`);
      parent = await this.cropMonitoringRepository.createParent({
        policyId: new Types.ObjectId(policyId),
        farmId: new Types.ObjectId(resolvedFarmId),
        assessorId: new Types.ObjectId(assessorId),
        status: CropMonitoringStatus.IN_PROGRESS,
      });
    }

    // Check existing cycles under this parent
    const existingCycles = await this.cropMonitoringRepository.findCyclesByParentId(this.extractId(parent._id));
    const completedCount = existingCycles.filter(
      c => c.status === CropMonitoringStatus.COMPLETED,
    ).length;
    const hasActive = existingCycles.some(c => c.status === CropMonitoringStatus.IN_PROGRESS);

    const maxCycles = getRequiredMonitoringCycles(farm.cropType);
    this.logger.debug(
      `Monitoring cycles: ${completedCount} completed, ${
        hasActive ? 1 : 0
      } active / ${maxCycles} max`,
    );

    if (hasActive) {
      throw new BadRequestException('A monitoring cycle is already in progress for this policy.');
    }

    if (completedCount >= maxCycles) {
      throw new BadRequestException(
        `Maximum ${maxCycles} monitoring cycles have been completed for this ${farm.cropType} crop.`,
      );
    }

    // Determine monitoring number
    const monitoringNumber = existingCycles.length + 1;

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

    // Create monitoring cycle record
    const cycle = await this.cropMonitoringRepository.createCycle({
      cropMonitoringId: parent._id as Types.ObjectId,
      monitoringNumber,
      monitoringDate: new Date(),
      weatherData,
      status: CropMonitoringStatus.IN_PROGRESS,
    });

    this.logger.log(`Crop monitoring cycle ${monitoringNumber} started for parent ${parent._id}`);

    // Return the cycle with parent details flattened for frontend compatibility
    const formattedCycle = {
      ...(cycle.toObject?.() ?? cycle),
      policyId: parent.policyId,
      farmId: parent.farmId,
      assessorId: parent.assessorId,
    };

    return this.attachRecommendation(formattedCycle, farm);
  }

  /**
   * Update crop monitoring data (updates a specific cycle)
   */
  async updateMonitoring(
    assessorId: string,
    cycleId: string,
    updateData: {
      observations?: string[];
      notes?: string;
      ndviData?: object;
      photoUrls?: string[];
    },
  ): Promise<any> {
    // Validate cycle exists
    const cycle = await this.cropMonitoringRepository.findCycleById(cycleId);
    if (!cycle) {
      throw new NotFoundException(`Crop monitoring cycle with ID ${cycleId} not found`);
    }

    // Retrieve parent
    const parent = await this.cropMonitoringRepository.findParentById(this.extractId(cycle.cropMonitoringId));
    if (!parent) {
      throw new NotFoundException(`Parent monitoring not found for cycle ${cycleId}`);
    }

    if (this.extractId(parent.assessorId) !== assessorId) {
      throw new BadRequestException('Crop monitoring does not belong to this assessor');
    }

    // Validate cycle is in progress
    if (cycle.status !== CropMonitoringStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot update cycle. Current status: ${cycle.status}`,
      );
    }

    // Update cycle
    const updatedCycle = await this.cropMonitoringRepository.updateCycle(cycleId, updateData);
    if (!updatedCycle) {
      throw new NotFoundException(`Crop monitoring cycle with ID ${cycleId} not found`);
    }

    return {
      ...(updatedCycle.toObject?.() ?? updatedCycle),
      policyId: parent.policyId,
      farmId: parent.farmId,
      assessorId: parent.assessorId,
    };
  }

  /**
   * Generate monitoring report (for a specific cycle)
   * Validates completeness and sends to insurer
   */
  async generateMonitoringReport(assessorId: string, cycleId: string): Promise<any> {
    // Validate cycle exists
    const cycle = await this.cropMonitoringRepository.findCycleById(cycleId);
    if (!cycle) {
      throw new NotFoundException(`Crop monitoring cycle with ID ${cycleId} not found`);
    }

    // Retrieve parent
    const parent = await this.cropMonitoringRepository.findParentById(this.extractId(cycle.cropMonitoringId));
    if (!parent) {
      throw new NotFoundException(`Parent monitoring not found for cycle ${cycleId}`);
    }

    if (this.extractId(parent.assessorId) !== assessorId) {
      throw new BadRequestException('Crop monitoring does not belong to this assessor');
    }

    // Validate cycle is in progress
    if (cycle.status !== CropMonitoringStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot generate report. Current status: ${cycle.status}`);
    }

    // Validate required fields
    const missingFields: string[] = [];

    if (!cycle.notes || cycle.notes.trim() === '') {
      missingFields.push('Notes (Assessor notes are required)');
    }

    // Validate that at least one drone report is uploaded and processed
    const uploadedPdfs = cycle.droneAnalysisPdfs || [];
    if (uploadedPdfs.length === 0) {
      missingFields.push('Drone Analysis Report (At least one report is required)');
    } else {
      // Check if anyway uploaded PDFs have extraction failures
      const pdfsWithoutData = uploadedPdfs.filter((pdf: any) => !pdf.droneAnalysisData);
      if (pdfsWithoutData.length > 0) {
        const pdfTypes = pdfsWithoutData
          .map((pdf: any) => pdf.pdfType.replace('_', ' '))
          .join(', ');
        missingFields.push(`Data extraction for ${pdfTypes} report(s)`);
      }
    }

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Cannot generate report. Missing required fields or processed data: ${missingFields.join(', ')}`,
      );
    }

    // Check if report already generated
    if (cycle.reportGenerated) {
      throw new BadRequestException('Report has already been generated');
    }

    const reportGeneratedAt = new Date();

    // Update cycle with report generation
    const updatedCycle = await this.cropMonitoringRepository.updateCycle(cycleId, {
      reportGenerated: true,
      reportGeneratedAt,
      status: CropMonitoringStatus.COMPLETED,
    });

    // Check if all recommended cycles have been completed.
    try {
      const farm = await this.farmsRepository.findById(this.extractId(parent.farmId));
      if (farm) {
        const cycles = await this.cropMonitoringRepository.findCyclesByParentId(this.extractId(parent._id));
        const maxCycles = getRequiredMonitoringCycles(farm.cropType);
        const completedCount = cycles.filter(
          c => c.status === CropMonitoringStatus.COMPLETED || this.extractId((c as any)._id) === cycleId
        ).length;

        if (completedCount >= maxCycles) {
          await this.cropMonitoringRepository.updateParent(this.extractId(parent._id), {
            status: CropMonitoringStatus.COMPLETED,
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to update parent status: ${err.message}`);
    }

    // Notify insurer
    try {
      const policy = await this.policiesRepository.findById(this.extractId(parent.policyId));
      if (policy) {
        const insurer = await this.usersRepository.findById(this.extractId(policy.insurerId));
        if (insurer) {
          const farm = await this.farmsRepository.findById(this.extractId(parent.farmId));
          await this.emailService
            .sendMonitoringReportEmail(
              insurer.email,
              insurer.firstName,
              farm?.name || 'Farm',
              cycleId,
              cycle.monitoringNumber,
            )
            .catch(error => {
              this.logger.error(`Failed to send monitoring report email: ${error.message}`);
            });
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to notify insurer about monitoring report: ${error.message}`);
    }

    this.logger.log(`Monitoring report generated for cycle ${cycleId}`);

    return {
      monitoringId: cycleId,
      policyId: parent.policyId,
      farmId: parent.farmId,
      assessorId: parent.assessorId,
      monitoringNumber: cycle.monitoringNumber,
      monitoringDate: cycle.monitoringDate,
      weatherData: cycle.weatherData,
      ndviData: cycle.ndviData,
      observations: cycle.observations,
      notes: cycle.notes,
      droneAnalysisPdfs: cycle.droneAnalysisPdfs || [],
      reportGenerated: true,
      reportGeneratedAt,
      status: CropMonitoringStatus.COMPLETED,
    };
  }

  /**
   * Get all monitoring tasks for an assessor
   */
  async getAssessorMonitoringTasks(assessorId: string): Promise<any[]> {
    const parents = await this.cropMonitoringRepository.findParentsByAssessorId(assessorId);
    const allCycles: any[] = [];
    await Promise.all(
      parents.map(async parent => {
        const farm = await this.farmsRepository.findById(this.extractId(parent.farmId));
        const cycles = await this.cropMonitoringRepository.findCyclesByParentId(this.extractId(parent._id));
        cycles.forEach(cycle => {
          const formatted = {
            ...(cycle.toObject?.() ?? cycle),
            policyId: parent.policyId,
            farmId: parent.farmId,
            assessorId: parent.assessorId,
          };
          allCycles.push(this.attachRecommendation(formatted, farm));
        });
      }),
    );
    return allCycles;
  }

  /**
   * Get all monitoring tasks for an insurer
   */
  async getInsurerMonitoringTasks(insurerId: string): Promise<any[]> {
    const policies = await this.policiesRepository.findByInsurerId(insurerId);
    const policyIds = policies.map(p => new Types.ObjectId(p._id as string));

    if (policyIds.length === 0) {
      return [];
    }

    const parents = await this.cropMonitoringRepository.findParentsByPolicyIds(policyIds);
    const allCycles: any[] = [];
    await Promise.all(
      parents.map(async parent => {
        const farm = await this.farmsRepository.findById(this.extractId(parent.farmId));
        const cycles = await this.cropMonitoringRepository.findCyclesByParentId(this.extractId(parent._id));
        cycles.forEach(cycle => {
          const formatted = {
            ...(cycle.toObject?.() ?? cycle),
            policyId: parent.policyId,
            farmId: parent.farmId,
            assessorId: parent.assessorId,
          };
          allCycles.push(this.attachRecommendation(formatted, farm));
        });
      }),
    );
    return allCycles;
  }

  /**
   * Get monitoring cycle stats grouped by field (only fields with active policies)
   */
  async getMonitoringFields(): Promise<any[]> {
    const activePolicies = await this.policiesRepository.findAll({ status: 'ACTIVE' });
    const farmToPolicyMap = new Map<string, string>();
    activePolicies.forEach(p => {
      farmToPolicyMap.set(this.extractId(p.farmId), this.extractId(p._id as any));
    });

    const farmsData = await this.farmsRepository.findAll(0, 1000);
    const farms = farmsData.items.filter(farm => farmToPolicyMap.has(this.extractId(farm._id as any)));

    const stats = await Promise.all(
      farms.map(async (farm) => {
        const farmIdStr = this.extractId(farm._id as any);
        const parent = await this.cropMonitoringRepository.findParentByFarmId(farmIdStr);
        let cyclesCount = 0;
          let completedCycles = 0;
          let hasActiveCycle = false;
          let cropMonitoringId = null;
          
          if (parent) {
            const cycles = await this.cropMonitoringRepository.findCyclesByParentId(this.extractId(parent._id as any));
            cyclesCount = cycles.length;
            completedCycles = cycles.filter(c => c.status === 'COMPLETED').length;
            hasActiveCycle = cycles.some(c => c.status === 'IN_PROGRESS');
            cropMonitoringId = parent._id;
          }

          return {
            farmId: farm._id,
            policyId: farmToPolicyMap.get(farmIdStr),
            name: farm.name || 'Unnamed Field',
            location: farm.location,
            cropType: farm.cropType,
            hasMonitoring: !!parent,
            hasActiveCycle,
            completedCycles,
            cyclesCount,
            cropMonitoringId
          };
      })
    );

    return stats;
  }

  /**
   * Get all monitoring records for a policy
   */
  async getPolicyMonitoringRecords(policyId: string): Promise<any[]> {
    const parent = await this.cropMonitoringRepository.findParentByPolicyId(policyId);
    if (!parent) {
      return [];
    }

    const farm = await this.farmsRepository.findById(this.extractId(parent.farmId));
    const cycles = await this.cropMonitoringRepository.findCyclesByParentId(this.extractId(parent._id));
    return cycles.map(cycle => {
      const formatted = {
        ...(cycle.toObject?.() ?? cycle),
        policyId: parent.policyId,
        farmId: parent.farmId,
        assessorId: parent.assessorId,
      };
      return this.attachRecommendation(formatted, farm);
    });
  }

  /** All cycles — admin dashboard */
  async getAllMonitoringRecordsForAdmin() {
    const parents = await this.cropMonitoringRepository.findAllParents();
    const allCycles: any[] = [];
    await Promise.all(
      parents.map(async parent => {
        const farm = await this.farmsRepository.findById(this.extractId(parent.farmId));
        const cycles = await this.cropMonitoringRepository.findCyclesByParentId(this.extractId(parent._id));
        cycles.forEach(cycle => {
          const formatted = {
            ...(cycle.toObject?.() ?? cycle),
            policyId: parent.policyId,
            farmId: parent.farmId,
            assessorId: parent.assessorId,
          };
          allCycles.push(this.attachRecommendation(formatted, farm));
        });
      }),
    );
    return allCycles;
  }

  /** Single cycle / parent — details view */
  async getMonitoringByIdForAdmin(id: string) {
    let parent = await this.cropMonitoringRepository.findParentById(id);
    let targetCycle: any = null;

    if (!parent) {
      // Check if it is a cycle ID
      const cycle = await this.cropMonitoringRepository.findCycleById(id);
      if (cycle) {
        targetCycle = cycle;
        parent = await this.cropMonitoringRepository.findParentById(this.extractId(cycle.cropMonitoringId));
      }
    }

    if (!parent) {
      throw new NotFoundException('CropMonitoring', id);
    }

    const farm = await this.farmsRepository.findById(this.extractId(parent.farmId));
    const cycles = await this.cropMonitoringRepository.findCyclesByParentId(this.extractId(parent._id));

    const formattedCycles = cycles.map(cycle => {
      const formatted = {
        ...(cycle.toObject?.() ?? cycle),
        policyId: parent.policyId,
        farmId: parent.farmId,
        assessorId: parent.assessorId,
      };
      return this.attachRecommendation(formatted, farm);
    });

    // If a cycle ID was queried, we also flatten it or return parent with cycles
    const parentObj = {
      ...(parent.toObject?.() ?? parent),
      monitoringCycles: formattedCycles,
    };

    return this.attachRecommendation(parentObj, farm);
  }

  /**
   * Upload drone analysis PDF for a specific cycle
   */
  async uploadDroneAnalysis(
    assessorId: string,
    cycleId: string,
    pdfFile: Express.Multer.File,
    pdfType: PdfType,
  ): Promise<any> {
    const cycle = await this.cropMonitoringRepository.findCycleById(cycleId);
    if (!cycle) {
      throw new NotFoundException(`Crop monitoring cycle with ID ${cycleId} not found`);
    }

    const parent = await this.cropMonitoringRepository.findParentById(this.extractId(cycle.cropMonitoringId));
    if (!parent) {
      throw new NotFoundException(`Parent monitoring not found for cycle ${cycleId}`);
    }

    if (this.extractId(parent.assessorId) !== assessorId) {
      throw new BadRequestException('Crop monitoring does not belong to this assessor');
    }

    if (pdfFile.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const existingPdfs = cycle.droneAnalysisPdfs || [];
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
    const filename = `${pdfType}-monitoring-cycle-${cycleId}-${timestamp}-${randomStr}.pdf`;
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

    const newPdfEntry = {
      pdfType,
      pdfUrl,
      uploadedAt: new Date(),
    };

    const updatedPdfs = [...existingPdfs, newPdfEntry];
    const updatedCycle = await this.cropMonitoringRepository.updateCycle(cycleId, {
      droneAnalysisPdfs: updatedPdfs,
    });
    if (!updatedCycle) {
      throw new NotFoundException(`Crop monitoring cycle with ID ${cycleId} not found`);
    }

    const farm = await this.farmsRepository.findById(this.extractId(parent.farmId));
    const formattedCycle = {
      ...(updatedCycle.toObject?.() ?? updatedCycle),
      policyId: parent.policyId,
      farmId: parent.farmId,
      assessorId: parent.assessorId,
    };

    return {
      monitoringId: cycleId,
      pdfType,
      pdfUrl,
      droneAnalysisData: null,
      monitoring: this.attachRecommendation(formattedCycle, farm),
    };
  }

  /**
   * Get all uploaded PDFs for a monitoring cycle
   */
  async processDronePdf(cycleId: string, pdfType: string) {
    const cycle = await this.cropMonitoringRepository.findCycleById(cycleId);
    if (!cycle) {
      throw new NotFoundException(`Crop monitoring cycle with ID ${cycleId} not found`);
    }

    const parent = await this.cropMonitoringRepository.findParentById(this.extractId(cycle.cropMonitoringId));
    if (!parent) {
      throw new NotFoundException(`Parent monitoring not found for cycle ${cycleId}`);
    }

    if (cycle.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Cannot process PDF for a completed cycle');
    }

    const existingPdfs = cycle.droneAnalysisPdfs || [];
    const pdfIndex = existingPdfs.findIndex((p: any) => p.pdfType === pdfType);
    
    if (pdfIndex === -1) {
      throw new NotFoundException(`PDF of type ${pdfType} not found in this cycle`);
    }

    const pdfData = existingPdfs[pdfIndex];
    if (pdfData.droneAnalysisData) {
      throw new BadRequestException(`PDF of type ${pdfType} is already processed`);
    }

    const filename = pdfData.pdfUrl.split('/').pop() || '';
    const filePath = path.join(process.cwd(), 'uploads', 'drone-analysis', filename);
    const absoluteFilePath = path.resolve(filePath);

    if (!fs.existsSync(absoluteFilePath)) {
      throw new BadRequestException('PDF file not found on disk');
    }

    let droneAnalysisData = null;
    try {
      this.logger.log(`Calling drone analysis service for: ${absoluteFilePath}`);
      const analysisResult = await this.droneAnalysisService.extractDroneData(absoluteFilePath);

      if (analysisResult.success && analysisResult.extractedData) {
        droneAnalysisData = analysisResult.extractedData;
        this.logger.log('Successfully extracted drone data');
      } else {
        throw new BadRequestException(`Drone data extraction failed: ${analysisResult.error}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to extract drone data: ${error.message}`);
      throw new BadRequestException(`Failed to process PDF: ${error.message}`);
    }

    existingPdfs[pdfIndex] = {
      ...(typeof (pdfData as any).toObject === 'function' ? (pdfData as any).toObject() : pdfData),
      droneAnalysisData,
    };

    const updatedCycle = await this.cropMonitoringRepository.updateCycle(cycleId, {
      droneAnalysisPdfs: existingPdfs,
    });

    if (!updatedCycle) {
      throw new NotFoundException(`Crop monitoring cycle with ID ${cycleId} not found`);
    }

    const farm = await this.farmsRepository.findById(this.extractId(parent.farmId));
    const formattedCycle = {
      ...(updatedCycle.toObject?.() ?? updatedCycle),
      policyId: parent.policyId,
      farmId: parent.farmId,
      assessorId: parent.assessorId,
    };

    return this.attachRecommendation(formattedCycle, farm);
  }

  async getUploadedPdfs(cycleId: string): Promise<any> {
    const cycle = await this.cropMonitoringRepository.findCycleById(cycleId);
    if (!cycle) {
      throw new NotFoundException(`Crop monitoring cycle with ID ${cycleId} not found`);
    }
    return cycle.droneAnalysisPdfs || [];
  }

  /**
   * Delete a specific PDF from a monitoring cycle
   */
  async deletePdf(assessorId: string, cycleId: string, pdfType: PdfType): Promise<any> {
    const cycle = await this.cropMonitoringRepository.findCycleById(cycleId);
    if (!cycle) {
      throw new NotFoundException(`Crop monitoring cycle with ID ${cycleId} not found`);
    }

    const parent = await this.cropMonitoringRepository.findParentById(this.extractId(cycle.cropMonitoringId));
    if (!parent) {
      throw new NotFoundException(`Parent monitoring not found for cycle ${cycleId}`);
    }

    if (this.extractId(parent.assessorId) !== assessorId) {
      throw new BadRequestException('Crop monitoring does not belong to this assessor');
    }

    const existingPdfs = cycle.droneAnalysisPdfs || [];
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

    const updatedCycle = await this.cropMonitoringRepository.updateCycle(cycleId, {
      droneAnalysisPdfs: updatedPdfs,
    });
    if (!updatedCycle) {
      throw new NotFoundException(`Crop monitoring cycle with ID ${cycleId} not found`);
    }

    const farm = await this.farmsRepository.findById(this.extractId(parent.farmId));
    const formattedCycle = {
      ...(updatedCycle.toObject?.() ?? updatedCycle),
      policyId: parent.policyId,
      farmId: parent.farmId,
      assessorId: parent.assessorId,
    };

    return {
      monitoringId: cycleId,
      pdfType,
      message: `${pdfType.replace('_', ' ')} PDF deleted successfully`,
      monitoring: this.attachRecommendation(formattedCycle, farm),
    };
  }

  private extractId(id: any): string {
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (id instanceof Types.ObjectId) return id.toString();
    return id._id ? id._id.toString() : id.toString();
  }

  private attachRecommendation(monitoring: any, farm: any) {
    if (!farm?.sowingDate || !farm?.cropType) {
      return monitoring;
    }

    const totalRecommendedCycles = getRequiredMonitoringCycles(farm.cropType);
    const nextMonitoringDate = new Date(farm.sowingDate);
    const monitoringNum = monitoring.monitoringNumber || 1;
    nextMonitoringDate.setDate(nextMonitoringDate.getDate() + monitoringNum * 30);

    return {
      ...(monitoring.toObject?.() ?? monitoring),
      totalRecommendedCycles,
      recommendedNextMonitoringDate: nextMonitoringDate.toISOString(),
    };
  }
}

