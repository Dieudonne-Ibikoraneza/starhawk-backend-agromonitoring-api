import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { AssessmentsRepository } from './assessments.repository';
import { FarmsRepository } from '../farms/farms.repository';
import { UsersRepository } from '../users/users.repository';
import { ProfilesRepository } from '../users/profiles.repository';
import { EosdaService } from '../eosda/eosda.service';
import { EmailService } from '../email/email.service';
import { RiskScoringService } from './services/risk-scoring.service';
import { DroneAnalysisService } from './services/drone-analysis.service';
import { LocationService } from '../farms/services/location.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { AssignAssessorDto } from './dto/assign-assessor.dto';
import { AssessmentStatus } from './enums/assessment-status.enum';
import { FarmStatus } from '../farms/enums/farm-status.enum';
import { CropType } from '../farms/enums/crop-type.enum';
import { Role } from '../users/enums/role.enum';
import { FarmerWithFarmsResponseDto } from './dto/farmer-with-farms-response.dto';
import { FarmResponseDto } from '../farms/dto/farm-response.dto';
import { PendingFarmResponseDto } from './dto/pending-farm-response.dto';
import { AssessmentReportResponseDto } from './dto/assessment-report-response.dto';

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private assessmentsRepository: AssessmentsRepository,
    private farmsRepository: FarmsRepository,
    private usersRepository: UsersRepository,
    private profilesRepository: ProfilesRepository,
    private eosdaService: EosdaService,
    private emailService: EmailService,
    private riskScoringService: RiskScoringService,
    private droneAnalysisService: DroneAnalysisService,
    private locationService: LocationService,
  ) {}

  /**
   * Helper method to extract ID from assessorId whether it's populated or not
   */
  private extractAssessorId(assessorId: any): string {
    if (!assessorId) return '';
    if (assessorId instanceof Types.ObjectId) {
      return assessorId.toString();
    } else if (assessorId._id) {
      return assessorId._id.toString();
    } else if (typeof assessorId === 'string') {
      return assessorId;
    }
    return String(assessorId);
  }

  async createAssessment(insurerId: string | null, createDto: CreateAssessmentDto) {
    const farm = await this.farmsRepository.findById(createDto.farmId);
    if (!farm) {
      throw new NotFoundException('Farm', createDto.farmId);
    }

    // Check if assessment already exists for this farm
    const existing = await this.assessmentsRepository.findByFarmId(createDto.farmId);
    if (existing) {
      throw new BadRequestException('Assessment already exists for this farm');
    }

    const assessmentData: any = {
      farmId: new Types.ObjectId(createDto.farmId),
      assessorId: new Types.ObjectId(createDto.assessorId),
      status: AssessmentStatus.ASSIGNED,
    };

    // Only add insurerId if provided (optional for admin assignments)
    if (insurerId) {
      assessmentData.insurerId = new Types.ObjectId(insurerId);
    }

    const assessment = await this.assessmentsRepository.create(assessmentData);

    // Notify assessor (email notification will be added)
    return assessment;
  }

  async updateAssessment(assessorId: string, assessmentId: string, updateDto: UpdateAssessmentDto) {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment', assessmentId);
    }

    if (this.extractAssessorId(assessment.assessorId) !== assessorId) {
      throw new BadRequestException('This assessment is not assigned to you');
    }

    // Update status to IN_PROGRESS if not already
    if (assessment.status === AssessmentStatus.ASSIGNED) {
      updateDto = { ...updateDto } as any;
      (updateDto as any).status = AssessmentStatus.IN_PROGRESS;
    }

    return this.assessmentsRepository.update(assessmentId, updateDto);
  }

  /**
   * @deprecated Risk score calculation is no longer required for assessment reports.
   * This method is kept for backward compatibility and potential use in premium calculation.
   * The endpoint POST /assessments/:id/calculate-risk has been removed.
   */
  async calculateRiskScore(assessmentId: string): Promise<number> {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment', assessmentId);
    }

    // farmId is already populated by findById, so check if it's a populated document
    // A populated document will have properties like 'name', 'eosdaFieldId', etc.
    // An unpopulated ObjectId will only have toString() and valueOf() methods
    let farm: any;
    if (assessment.farmId && typeof assessment.farmId === 'object' && 'name' in assessment.farmId) {
      // Already populated - use it directly
      farm = assessment.farmId;
    } else {
      // Not populated - fetch it using the ObjectId (shouldn't happen with current repository)
      const farmId =
        assessment.farmId instanceof Types.ObjectId
          ? assessment.farmId.toString()
          : assessment.farmId;
      farm = await this.farmsRepository.findById(farmId);
      if (!farm) {
        throw new NotFoundException('Farm not found');
      }
    }

    // Get weather history (2-5 years)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 3);

    // Get weather data - requires fieldId (EOSDA field must exist)
    let weatherData: any[] = [];
    if (farm.eosdaFieldId) {
      try {
        const weatherResponse = await this.eosdaService.weather.getHistoricalWeather({
          fieldId: farm.eosdaFieldId,
          dateStart: startDate.toISOString().split('T')[0],
          dateEnd: endDate.toISOString().split('T')[0],
        });
        // Convert historical_data to format expected by risk scoring
        weatherData = weatherResponse.historical_data.map(point => ({
          date: point.date,
          rainfall: point.rainfall,
          temperature: {
            min: point.temperature_min,
            max: point.temperature_max,
            average: (point.temperature_min + point.temperature_max) / 2,
          },
        }));
      } catch (error) {
        // Log but continue with empty weather data
        console.error('Failed to fetch weather data:', error);
      }
    }

    // Get NDVI history
    let ndviData: any[] = [];
    if (farm.eosdaFieldId) {
      try {
        const statsResponse = await this.eosdaService.statistics.getNDVITimeSeries({
          fieldId: farm.eosdaFieldId,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        });
        // Convert to format expected by risk scoring
        ndviData =
          statsResponse.indices.NDVI?.map(point => ({
            date: point.date,
            value: point.value,
          })) || [];
      } catch (error) {
        // Log but continue with empty NDVI data
        console.error('Failed to fetch NDVI data:', error);
      }
    }

    // Calculate risk score
    const riskScore = this.riskScoringService.calculateRiskScore(
      (farm.cropType || CropType.OTHER) as CropType,
      farm.area || 1,
      weatherData,
      ndviData,
    );

    // Update assessment with risk score
    await this.assessmentsRepository.update(assessmentId, { riskScore });

    return riskScore;
  }

  // submitAssessment method removed - report generation (generateFullReport) now handles submission
  // This method was redundant as generateFullReport already sets status to SUBMITTED

  async getAssessment(assessmentId: string) {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment', assessmentId);
    }
    return assessment;
  }

  async getAssessmentByFarmId(farmId: string) {
    const assessment = await this.assessmentsRepository.findByFarmId(farmId);
    if (!assessment) {
      return null;
    }
    return assessment;
  }

  async getAssessorAssessments(assessorId: string) {
    console.log('getAssessorAssessments called with assessorId:', assessorId);
    const assessments = await this.assessmentsRepository.findByAssessorId(assessorId);
    console.log(`Found ${assessments.length} assessments for assessor ${assessorId}`);
    return assessments;
  }

  async getInsurerAssessments(insurerId: string) {
    console.log('getInsurerAssessments called with insurerId:', insurerId);
    const assessments = await this.assessmentsRepository.findByInsurerId(insurerId);
    console.log(`Found ${assessments.length} assessments for insurer ${insurerId}`);
    return assessments;
  }

  async getAllAssessments() {
    console.log('getAllAssessments called');
    const assessments = await this.assessmentsRepository.findAll();
    console.log(`Found ${assessments.length} total assessments`);
    return assessments;
  }

  async getAllFarmersWithFarms(assessorId?: string): Promise<FarmerWithFarmsResponseDto[]> {
    // If assessorId is provided, only get farmers whose farms are assigned to this assessor
    let assignedFarmIds: string[] = [];
    if (assessorId) {
      const assessments = await this.assessmentsRepository.findByAssessorId(assessorId);
      assignedFarmIds = assessments
        .map(assessment => {
          // Handle both populated and unpopulated farmId
          const farmId = assessment.farmId as any;
          if (farmId && farmId._id) {
            // farmId is populated (Farm object)
            return farmId._id.toString();
          } else if (farmId) {
            // farmId is unpopulated (ObjectId)
            return farmId.toString();
          }
          return null;
        })
        .filter((id): id is string => id !== null);
    }

    // Get all farmers
    const farmersResult = await this.usersRepository.findByRole(
      Role.FARMER,
      0,
      1000, // Get all farmers (adjust limit as needed)
      'createdAt',
      'desc',
    );

    // Map each farmer to include their profile and farms
    const farmersWithFarms = await Promise.all(
      farmersResult.items.map(async farmer => {
        const farmerDoc = farmer as any;

        // Get farmer profile
        const farmerProfile = await this.profilesRepository.findFarmerProfileByUserId(
          farmerDoc._id.toString(),
        );

        // Get all farms for this farmer
        const farms = await this.farmsRepository.findByFarmerId(farmerDoc._id.toString());

        // Filter farms: if assessorId provided, only include assigned farms
        let filteredFarms = farms;
        if (assessorId && assignedFarmIds.length > 0) {
          filteredFarms = farms.filter((farm: any) =>
            assignedFarmIds.includes(farm._id.toString()),
          );
        }

        // Skip this farmer if no farms match the filter
        if (assessorId && filteredFarms.length === 0) {
          return null;
        }

        // Map farms to response DTO
        const farmsResponse: FarmResponseDto[] = await Promise.all(
          filteredFarms.map(async (farm: any) => {
            // Get location name from coordinates
            let locationName: string | undefined;
            if (
              farm.location &&
              farm.location.coordinates &&
              farm.location.coordinates.length >= 2
            ) {
              const latitude = farm.location.coordinates[1];
              const longitude = farm.location.coordinates[0];
              try {
                locationName = await this.locationService.getLocationString(latitude, longitude);
              } catch (err) {
                this.logger.warn(`Failed to get location name for farm ${farm._id}: ${err}`);
              }
            }

            return {
              id: farm._id.toString(),
              farmerId: farm.farmerId.toString(),
              name: farm.name,
              area: farm.area,
              cropType: farm.cropType,
              sowingDate: farm.sowingDate,
              location: farm.location,
              locationName: locationName,
              boundary: farm.boundary,
              status: farm.status,
              shapefilePath: farm.shapefilePath,
              eosdaFieldId: farm.eosdaFieldId,
              createdAt: farm.createdAt,
              updatedAt: farm.updatedAt,
            };
          }),
        );

        // Build response
        const response: FarmerWithFarmsResponseDto = {
          id: farmerDoc._id.toString(),
          email: farmer.email,
          phoneNumber: farmer.phoneNumber,
          nationalId: farmer.nationalId,
          firstName: farmer.firstName,
          lastName: farmer.lastName,
          role: farmer.role,
          active: farmer.active,
          firstLoginRequired: farmer.firstLoginRequired,
          province: farmer.province,
          district: farmer.district,
          sector: farmer.sector,
          cell: farmer.cell,
          village: farmer.village,
          sex: farmer.sex,
          farmerProfile: farmerProfile
            ? {
                farmProvince: farmerProfile.farmProvince,
                farmDistrict: farmerProfile.farmDistrict,
                farmSector: farmerProfile.farmSector,
                farmCell: farmerProfile.farmCell,
                farmVillage: farmerProfile.farmVillage,
              }
            : undefined,
          farms: farmsResponse,
          createdAt: farmerDoc.createdAt,
          updatedAt: farmerDoc.updatedAt,
        };

        return response;
      }),
    );

    // Filter out null values (farmers with no assigned farms when assessorId provided)
    return farmersWithFarms.filter(farmer => farmer !== null) as FarmerWithFarmsResponseDto[];
  }

  async isAssessorAssignedToFarmer(assessorId: string, farmerId: string): Promise<boolean> {
    return this.assessmentsRepository.isAssessorAssignedToFarmer(assessorId, farmerId);
  }

  async isAssessorAssignedToFarm(assessorId: string, farmId: string): Promise<boolean> {
    return this.assessmentsRepository.isAssessorAssignedToFarm(assessorId, farmId);
  }

  async getPendingFarms(): Promise<PendingFarmResponseDto[]> {
    const farms = await this.farmsRepository.findByStatus(FarmStatus.PENDING);

    return Promise.all(
      farms.map(async farm => {
        const farmDoc = farm as any;
        const farmer = farm.farmerId as any;

        // Get farmer profile
        const farmerProfile = await this.profilesRepository.findFarmerProfileByUserId(
          farmer._id.toString(),
        );

        // Build farmer response
        const farmerResponse: any = {
          id: farmer._id.toString(),
          email: farmer.email,
          phoneNumber: farmer.phoneNumber,
          nationalId: farmer.nationalId,
          firstName: farmer.firstName,
          lastName: farmer.lastName,
          role: farmer.role,
          active: farmer.active,
          firstLoginRequired: farmer.firstLoginRequired,
          province: farmer.province,
          district: farmer.district,
          sector: farmer.sector,
          cell: farmer.cell,
          village: farmer.village,
          sex: farmer.sex,
          createdAt: farmer.createdAt,
          updatedAt: farmer.updatedAt,
        };

        if (farmerProfile) {
          farmerResponse.farmerProfile = {
            farmProvince: farmerProfile.farmProvince,
            farmDistrict: farmerProfile.farmDistrict,
            farmSector: farmerProfile.farmSector,
            farmCell: farmerProfile.farmCell,
            farmVillage: farmerProfile.farmVillage,
          };
        }

        return {
          id: farmDoc._id.toString(),
          cropType: farm.cropType,
          sowingDate: farm.sowingDate,
          name: farm.name,
          farmer: farmerResponse,
          createdAt: farmDoc.createdAt,
          updatedAt: farmDoc.updatedAt,
        };
      }),
    );
  }

  async assignAssessorToFarm(farmId: string, assessorId: string, insurerId?: string) {
    // Validate farm exists
    const farm = await this.farmsRepository.findById(farmId);
    if (!farm) {
      throw new NotFoundException('Farm', farmId);
    }

    // Validate farm is in PENDING status
    if (farm.status !== FarmStatus.PENDING) {
      throw new BadRequestException(
        `Farm is ${farm.status}. Only farms with PENDING status can be assigned to assessors.`,
      );
    }

    // Validate assessor exists and has ASSESSOR role
    const assessor = await this.usersRepository.findById(assessorId);
    if (!assessor) {
      throw new NotFoundException('Assessor', assessorId);
    }
    if (assessor.role !== Role.ASSESSOR) {
      throw new BadRequestException('User is not an assessor');
    }

    // Check if assessment already exists for this farm
    const existing = await this.assessmentsRepository.findByFarmId(farmId);
    if (existing) {
      throw new BadRequestException('Assessment already exists for this farm');
    }

    // Create assessment
    const assessmentData: any = {
      farmId: new Types.ObjectId(farmId),
      assessorId: new Types.ObjectId(assessorId),
      status: AssessmentStatus.ASSIGNED,
    };

    // Add insurerId if provided
    if (insurerId) {
      assessmentData.insurerId = new Types.ObjectId(insurerId);
    }

    const assessment = await this.assessmentsRepository.create(assessmentData);

    // Notify assessor about assignment
    try {
      const farmName = farm.name || `Farm ${farmId}`;
      await this.emailService
        .sendAssessmentAssignmentEmail(
          assessor.email,
          assessor.firstName,
          farmName,
          (assessment._id as any).toString(),
        )
        .catch(error => {
          // Log but don't fail assignment if email fails
          console.error(`Failed to send assessment assignment email: ${error.message}`);
        });
    } catch (error) {
      // Log but don't fail assignment if notification fails
      console.error(`Failed to send assessor notification: ${error.message}`);
    }

    return assessment;
  }

  /**
   * Upload drone analysis PDF for an assessment
   */
  async uploadDroneAnalysis(
    assessorId: string,
    assessmentId: string,
    pdfFile: Express.Multer.File,
    pdfType: 'plant_health' | 'flowering',
  ): Promise<any> {
    // Validate assessment exists and belongs to assessor
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment', assessmentId);
    }

    if (this.extractAssessorId(assessment.assessorId) !== assessorId) {
      throw new BadRequestException('Assessment does not belong to this assessor');
    }

    // Validate file is PDF
    if (pdfFile.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    // Validate PDF type
    if (!['plant_health', 'flowering'].includes(pdfType)) {
      throw new BadRequestException('PDF type must be either plant_health or flowering');
    }

    // Check if PDF of this type already exists
    const existingPdfs = assessment.droneAnalysisPdfs || [];
    const existingPdf = existingPdfs.find(pdf => pdf.pdfType === pdfType);
    if (existingPdf) {
      throw new BadRequestException(
        `A ${pdfType.replace('_', ' ')} PDF has already been uploaded for this assessment`,
      );
    }

    // When using diskStorage, file.buffer is undefined - use file.path instead
    // When using memoryStorage, file.path is undefined - use file.buffer instead
    if (!pdfFile.path && !pdfFile.buffer) {
      throw new BadRequestException('File data is missing - no path or buffer available');
    }

    // Save PDF file
    const fs = require('fs');
    const path = require('path');
    const uploadDir = './uploads/drone-analysis';

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const filename = `${pdfType}-${assessmentId}-${timestamp}-${randomStr}.pdf`;
    const filePath = path.join(uploadDir, filename);

    // Handle file based on storage type
    // If using diskStorage, file.path is available; if memoryStorage, file.buffer is available
    if (pdfFile.path) {
      // File was saved to disk by Multer - move/rename it to our desired location
      if (fs.existsSync(pdfFile.path)) {
        fs.renameSync(pdfFile.path, filePath);
      } else {
        throw new BadRequestException('Uploaded file not found on disk');
      }
    } else if (pdfFile.buffer) {
      // File is in memory - write it to disk
      fs.writeFileSync(filePath, pdfFile.buffer);
    } else {
      throw new BadRequestException('Unable to process file - no path or buffer available');
    }

    // Create URL (relative path)
    const pdfUrl = `/uploads/drone-analysis/${filename}`;

    // Convert to absolute path for Python service
    const absoluteFilePath = path.resolve(filePath);

    // Call Python service to extract data
    let droneAnalysisData = null;
    try {
      console.log(`Calling drone analysis service for: ${absoluteFilePath}`);
      const analysisResult = await this.droneAnalysisService.extractDroneData(absoluteFilePath);
      console.log('Drone analysis result:', analysisResult);

      if (analysisResult.success && analysisResult.extractedData) {
        droneAnalysisData = analysisResult.extractedData;
        console.log('Successfully extracted drone data');
      } else {
        // Log warning but continue - PDF is saved even if extraction fails
        console.warn(
          `Drone data extraction failed for assessment ${assessmentId}: ${analysisResult.error}`,
        );
      }
    } catch (error) {
      // Log error but continue - PDF is saved even if extraction fails
      console.error(
        `Failed to extract drone data for assessment ${assessmentId}: ${error.message}`,
      );
    }

    // Create new PDF entry
    const newPdfEntry = {
      pdfType,
      pdfUrl,
      droneAnalysisData,
      uploadedAt: new Date(),
    };

    // Update assessment with new PDF in the array
    const updatedPdfs = [...existingPdfs, newPdfEntry];
    const updatedAssessment = await this.assessmentsRepository.update(assessmentId, {
      droneAnalysisPdfs: updatedPdfs,
    });

    return {
      assessmentId,
      pdfType,
      pdfUrl,
      droneAnalysisData,
      assessment: updatedAssessment,
    };
  }

  /**
   * Get all uploaded PDFs for an assessment
   */
  async getUploadedPdfs(assessmentId: string): Promise<any> {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment', assessmentId);
    }

    return assessment.droneAnalysisPdfs || [];
  }

  /**
   * Delete a specific PDF from an assessment
   */
  async deletePdf(
    assessorId: string,
    assessmentId: string,
    pdfType: 'plant_health' | 'flowering',
  ): Promise<any> {
    // Validate assessment exists and belongs to assessor
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment', assessmentId);
    }

    if (this.extractAssessorId(assessment.assessorId) !== assessorId) {
      throw new BadRequestException('Assessment does not belong to this assessor');
    }

    const existingPdfs = assessment.droneAnalysisPdfs || [];
    const pdfIndex = existingPdfs.findIndex(pdf => pdf.pdfType === pdfType);

    if (pdfIndex === -1) {
      throw new BadRequestException(
        `No ${pdfType.replace('_', ' ')} PDF found for this assessment`,
      );
    }

    // Remove file from filesystem
    const fs = require('fs');
    const path = require('path');
    const pdfToDelete = existingPdfs[pdfIndex];
    const filePath = path.join('.', pdfToDelete.pdfUrl);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from array
    const updatedPdfs = existingPdfs.filter(pdf => pdf.pdfType !== pdfType);

    const updatedAssessment = await this.assessmentsRepository.update(assessmentId, {
      droneAnalysisPdfs: updatedPdfs,
    });

    return {
      assessmentId,
      pdfType,
      message: `${pdfType.replace('_', ' ')} PDF deleted successfully`,
      assessment: updatedAssessment,
    };
  }

  /**
   * Fetch weather data from EOSDA for an assessment
   * @param farm - Farm object with eosdaFieldId
   * @returns Weather data array or empty array if fetch fails
   */
  private async fetchWeatherData(farm: any): Promise<any> {
    if (!farm?.eosdaFieldId) {
      console.warn('Farm does not have eosdaFieldId, cannot fetch weather data');
      return null;
    }

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 3); // 3 years of historical data

      const weatherResponse = await this.eosdaService.weather.getHistoricalWeather({
        fieldId: farm.eosdaFieldId,
        dateStart: startDate.toISOString().split('T')[0],
        dateEnd: endDate.toISOString().split('T')[0],
      });

      // Return the full weather response for the report
      return weatherResponse;
    } catch (error) {
      console.error('Failed to fetch weather data from EOSDA:', error);
      return null;
    }
  }

  /**
   * Generate full assessment report
   * Compiles and returns structured report with: Farm Details, Drone Analysis, Comprehensive Notes, Weather Data
   */
  async generateFullReport(assessorId: string, assessmentId: string): Promise<any> {
    // Validate assessment exists and belongs to assessor
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment', assessmentId);
    }

    if (this.extractAssessorId(assessment.assessorId) !== assessorId) {
      throw new BadRequestException('Assessment does not belong to this assessor');
    }

    // Validate required fields are complete
    const missingFields: string[] = [];

    if (!assessment.comprehensiveNotes || assessment.comprehensiveNotes.trim() === '') {
      missingFields.push('Comprehensive assessment notes');
    }

    // Validate that both PDF types are uploaded
    const uploadedPdfs = assessment.droneAnalysisPdfs || [];
    const hasPlantHealth = uploadedPdfs.some(pdf => pdf.pdfType === 'plant_health');
    const hasFlowering = uploadedPdfs.some(pdf => pdf.pdfType === 'flowering');

    if (!hasPlantHealth) {
      missingFields.push('Plant health PDF');
    }

    if (!hasFlowering) {
      missingFields.push('Flowering PDF');
    }

    // Check if any uploaded PDFs have extraction failures
    const pdfsWithoutData = uploadedPdfs.filter(pdf => !pdf.droneAnalysisData);
    if (pdfsWithoutData.length > 0) {
      const pdfTypes = pdfsWithoutData.map(pdf => pdf.pdfType.replace('_', ' ')).join(', ');
      missingFields.push(`Data extraction for ${pdfTypes} PDF(s)`);
    }

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Cannot generate report. Missing required fields: ${missingFields.join(', ')}`,
      );
    }

    // Check if report already generated
    if (assessment.reportGenerated) {
      throw new BadRequestException('Report has already been generated');
    }

    // Get farm details (should be populated from findById)
    let farm: any;
    if (assessment.farmId && typeof assessment.farmId === 'object' && 'name' in assessment.farmId) {
      farm = assessment.farmId;
    } else {
      const farmId =
        assessment.farmId instanceof Types.ObjectId
          ? assessment.farmId.toString()
          : assessment.farmId;
      farm = await this.farmsRepository.findById(farmId);
      if (!farm) {
        throw new NotFoundException('Farm not found');
      }
    }

    // Fetch weather data if not already stored, then store it
    let weatherData = assessment.weatherData;
    if (!weatherData && farm.eosdaFieldId) {
      weatherData = await this.fetchWeatherData(farm);
      if (weatherData) {
        // Store weather data in assessment
        await this.assessmentsRepository.update(assessmentId, { weatherData });
      }
    }

    // Compile structured report
    const report = {
      assessmentId,
      farmDetails: {
        id: farm._id?.toString() || farm.id,
        name: farm.name,
        cropType: farm.cropType,
        area: farm.area,
        location: farm.location,
        boundary: farm.boundary,
        sowingDate: farm.sowingDate,
        eosdaFieldId: farm.eosdaFieldId,
        status: farm.status,
      },
      droneAnalysisPdfs: assessment.droneAnalysisPdfs || [],
      comprehensiveNotes: assessment.comprehensiveNotes,
      weatherData: weatherData || null,
      metadata: {
        reportGenerated: true,
        reportGeneratedAt: new Date(),
        status: AssessmentStatus.SUBMITTED,
      },
    };

    // Update assessment with report generation flag
    const updatedAssessment = await this.assessmentsRepository.update(assessmentId, {
      reportGenerated: true,
      reportGeneratedAt: new Date(),
      status: AssessmentStatus.SUBMITTED,
      weatherData: weatherData || assessment.weatherData,
    });

    // Notify insurer if assessment has an insurer
    if (assessment.insurerId) {
      try {
        const insurer = await this.usersRepository.findById(assessment.insurerId.toString());
        if (insurer) {
          const farmName = farm?.name || `Farm ${assessment.farmId}`;

          await this.emailService
            .sendReportReadyNotification(
              insurer.email,
              insurer.firstName,
              farmName,
              assessmentId,
              0, // Risk score no longer used, pass 0
            )
            .catch(error => {
              console.error(`Failed to send report ready notification: ${error.message}`);
            });
        }
      } catch (error) {
        console.error(`Failed to notify insurer about report: ${error.message}`);
      }
    }

    return report;
  }

  /**
   * Approve assessment (Insurer only)
   */
  async approveAssessment(insurerId: string, assessmentId: string): Promise<any> {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment', assessmentId);
    }

    // Validate assessment belongs to insurer
    if (!assessment.insurerId || assessment.insurerId.toString() !== insurerId) {
      throw new BadRequestException('Assessment does not belong to this insurer');
    }

    // Validate report is generated
    if (!assessment.reportGenerated) {
      throw new BadRequestException(
        'Cannot approve assessment. Report has not been generated yet.',
      );
    }

    // Validate assessment is in SUBMITTED status
    if (assessment.status !== AssessmentStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve assessment. Current status: ${assessment.status}. Only SUBMITTED assessments can be approved.`,
      );
    }

    // Update assessment status
    const updatedAssessment = await this.assessmentsRepository.update(assessmentId, {
      status: AssessmentStatus.APPROVED,
    });

    // Notify farmer and assessor
    try {
      const farm = await this.farmsRepository.findById(assessment.farmId.toString());
      const farmer = farm ? await this.usersRepository.findById(farm.farmerId.toString()) : null;
      const assessor = await this.usersRepository.findById(
        this.extractAssessorId(assessment.assessorId),
      );

      if (farmer) {
        await this.emailService
          .sendAssessmentApprovalEmail(
            farmer.email,
            farmer.firstName,
            farm?.name || 'Farm',
            assessmentId,
          )
          .catch(error => {
            console.error(`Failed to send approval email to farmer: ${error.message}`);
          });
      }

      if (assessor) {
        await this.emailService
          .sendAssessmentApprovalEmail(
            assessor.email,
            assessor.firstName,
            farm?.name || 'Farm',
            assessmentId,
          )
          .catch(error => {
            console.error(`Failed to send approval email to assessor: ${error.message}`);
          });
      }
    } catch (error) {
      console.error(`Failed to send approval notifications: ${error.message}`);
    }

    return updatedAssessment;
  }

  /**
   * Reject assessment (Insurer only)
   */
  async rejectAssessment(
    insurerId: string,
    assessmentId: string,
    rejectionReason: string,
  ): Promise<any> {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment', assessmentId);
    }

    // Validate assessment belongs to insurer
    if (!assessment.insurerId || assessment.insurerId.toString() !== insurerId) {
      throw new BadRequestException('Assessment does not belong to this insurer');
    }

    // Validate report is generated
    if (!assessment.reportGenerated) {
      throw new BadRequestException('Cannot reject assessment. Report has not been generated yet.');
    }

    // Validate assessment is in SUBMITTED status
    if (assessment.status !== AssessmentStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject assessment. Current status: ${assessment.status}. Only SUBMITTED assessments can be rejected.`,
      );
    }

    // Update assessment status and store rejection reason
    const updatedAssessment = await this.assessmentsRepository.update(assessmentId, {
      status: AssessmentStatus.REJECTED,
      reportText: assessment.reportText
        ? `${assessment.reportText}\n\nRejection Reason: ${rejectionReason}`
        : `Rejection Reason: ${rejectionReason}`,
    });

    // Notify farmer and assessor
    try {
      const farm = await this.farmsRepository.findById(assessment.farmId.toString());
      const farmer = farm ? await this.usersRepository.findById(farm.farmerId.toString()) : null;
      const assessor = await this.usersRepository.findById(
        this.extractAssessorId(assessment.assessorId),
      );

      if (farmer) {
        await this.emailService
          .sendAssessmentRejectionEmail(
            farmer.email,
            farmer.firstName,
            farm?.name || 'Farm',
            assessmentId,
            rejectionReason,
          )
          .catch(error => {
            console.error(`Failed to send rejection email to farmer: ${error.message}`);
          });
      }

      if (assessor) {
        await this.emailService
          .sendAssessmentRejectionEmail(
            assessor.email,
            assessor.firstName,
            farm?.name || 'Farm',
            assessmentId,
            rejectionReason,
          )
          .catch(error => {
            console.error(`Failed to send rejection email to assessor: ${error.message}`);
          });
      }
    } catch (error) {
      console.error(`Failed to send rejection notifications: ${error.message}`);
    }

    return updatedAssessment;
  }
}
