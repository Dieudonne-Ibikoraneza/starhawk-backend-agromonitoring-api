import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Types } from 'mongoose';
import { ClaimsRepository } from './claims.repository';
import { ClaimAssessmentsRepository } from './claim-assessments.repository';
import { PayoutsRepository } from './payouts.repository';
import { PoliciesRepository } from '../policies/policies.repository';
import { UsersRepository } from '../users/users.repository';
import { FarmsRepository } from '../farms/farms.repository';
import { EmailService } from '../email/email.service';
import { DamageAnalysisService } from './services/damage-analysis.service';
import { AssessmentsRepository } from '../assessments/assessments.repository';
import { CropMonitoringService } from '../monitoring/crop-monitoring.service';
import { CreateClaimDto } from './dto/create-claim.dto';
import { UpdateClaimAssessmentDto } from './dto/update-claim-assessment.dto';
import { ClaimStatus } from './enums/claim-status.enum';
import { ClaimType } from './enums/claim-type.enum';
import { LossEventType } from './enums/loss-event-type.enum';
import { PayoutStatus } from './schemas/payout.schema';
import { DroneAnalysisService } from '../assessments/services/drone-analysis.service';
import { PdfType } from '../assessments/dto/upload-drone-analysis.dto';
import { getCropHarvestDurationMonths } from '../farms/constants/crop-harvest-duration.constants';
import { PhotosService } from '../photos/photos.service';
import { PhotoType } from '../photos/enums/photo-type.enum';

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(
    private claimsRepository: ClaimsRepository,
    private claimAssessmentsRepository: ClaimAssessmentsRepository,
    private payoutsRepository: PayoutsRepository,
    private policiesRepository: PoliciesRepository,
    private usersRepository: UsersRepository,
    private farmsRepository: FarmsRepository,
    private emailService: EmailService,
    private damageAnalysisService: DamageAnalysisService,
    private droneAnalysisService: DroneAnalysisService,
    private assessmentsRepository: AssessmentsRepository,
    private cropMonitoringService: CropMonitoringService,
    private photosService: PhotosService,
  ) {}

  async fileClaim(farmerId: string, createDto: CreateClaimDto) {
    if (
      createDto.claimType &&
      createDto.claimType !== ClaimType.FARMER_REPORTED_LOSS
    ) {
      throw new BadRequestException('Farmers can only submit FARMER_REPORTED_LOSS claims');
    }

    const resolvedLossEventType = createDto.lossEventType || (createDto as any).eventType;
    if (!resolvedLossEventType) {
      throw new BadRequestException('lossEventType should not be empty');
    }

    // Verify policy belongs to farmer
    const policy = await this.policiesRepository.findById(createDto.policyId);
    if (!policy) {
      throw new NotFoundException('Policy', createDto.policyId);
    }

    if (this.extractId(policy.farmerId) !== farmerId) {
      throw new BadRequestException('Policy does not belong to this farmer');
    }

    // Verify policy is active
    if (policy.status !== 'ACTIVE') {
      throw new BadRequestException('Policy is not active');
    }

    // Process damage photos: upload base64 images to Supabase Storage
    const uploadedPhotos: string[] = [];
    if (createDto.damagePhotos && createDto.damagePhotos.length > 0) {
      this.logger.log(`Processing ${createDto.damagePhotos.length} damage photos for claim...`);
      for (const photo of createDto.damagePhotos) {
        if (photo.startsWith('data:') || photo.length > 1000) {
          try {
            const uploadResult = await this.photosService.uploadBase64Photo(
              photo,
              PhotoType.CLAIM,
              farmerId,
            );
            uploadedPhotos.push(uploadResult.url);
            this.logger.log(`Successfully uploaded damage photo to Supabase: ${uploadResult.url}`);
          } catch (uploadError: any) {
            this.logger.error(`Failed to upload damage photo to Supabase: ${uploadError.message}`);
            if (photo.startsWith('http://') || photo.startsWith('https://')) {
              uploadedPhotos.push(photo);
            }
          }
        } else {
          uploadedPhotos.push(photo);
        }
      }
    }

    const resolvedAssessorId = await this.resolveAssessorForPolicy(policy);

    const claim = await this.claimsRepository.create({
      policyId: new Types.ObjectId(createDto.policyId),
      farmerId: new Types.ObjectId(farmerId),
      farmId: policy.farmId as Types.ObjectId,
      lossEventType: resolvedLossEventType,
      claimType: ClaimType.FARMER_REPORTED_LOSS,
      lossDescription: createDto.lossDescription || createDto.description,
      damagePhotos: uploadedPhotos,
      lossEventDate: createDto.lossEventDate || createDto.eventDate ? new Date(createDto.lossEventDate || createDto.eventDate!) : undefined,
      estimatedLoss: typeof createDto.estimatedLoss !== 'undefined' && createDto.estimatedLoss !== null ? parseFloat(createDto.estimatedLoss) : undefined,
      status: ClaimStatus.FILED,
      assessorId: resolvedAssessorId ? new Types.ObjectId(resolvedAssessorId) : undefined,
    });

    if (resolvedAssessorId) {
      const assessment = await this.claimAssessmentsRepository.create({
        claimId: new Types.ObjectId(this.extractId((claim as any)._id)),
        assessorId: new Types.ObjectId(resolvedAssessorId),
      });
      const assessmentDoc = assessment as any;
      const updatedClaim = await this.claimsRepository.update(this.extractId((claim as any)._id), {
        assessmentReportId: assessmentDoc._id as Types.ObjectId,
        status: ClaimStatus.ASSIGNED,
      });
      return updatedClaim || claim;
    }

    // Send email notification to farmer
    try {
      const farmer = await this.usersRepository.findById(farmerId);
      if (farmer) {
        const claimDoc = claim as any;
        const eventDate = claimDoc.filedAt 
          ? new Date(claimDoc.filedAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        
        await this.emailService
          .sendClaimFiledEmail(
            farmer.email,
            farmer.firstName,
            claimDoc._id.toString(),
            resolvedLossEventType,
            eventDate,
          )
          .catch((error) => {
            console.error(
              `Failed to send claim filed email: ${error.message}`,
            );
          });
      }
    } catch (error) {
      // Log but don't fail claim filing if email fails
      console.error(
        `Failed to send claim filed notification: ${error.message}`,
      );
    }

    return claim;
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async autoSubmitHarvestClaims() {
    this.logger.log('Checking active policies for harvest-due auto claims...');
    const activePolicies = await this.policiesRepository.findAll({ status: 'ACTIVE' });

    for (const policy of activePolicies) {
      try {
        await this.createHarvestClaimIfDue(policy);
      } catch (error: any) {
        this.logger.error(
          `Failed harvest auto-claim check for policy ${this.extractId(policy._id)}: ${error.message}`,
        );
      }
    }
  }

  private async createHarvestClaimIfDue(policy: any) {
    const policyId = this.extractId(policy._id);
    const farmId = this.extractId(policy.farmId);
    const farmerId = this.extractId(policy.farmerId);

    const farm = await this.farmsRepository.findById(farmId);
    if (!farm?.sowingDate || !farm?.cropType) {
      return;
    }

    const harvestMonths = getCropHarvestDurationMonths(farm.cropType);
    const harvestDueDate = new Date(farm.sowingDate);
    harvestDueDate.setDate(harvestDueDate.getDate() + Math.round(harvestMonths * 30));

    if (new Date() < harvestDueDate) {
      return;
    }

    const existingHarvestClaim = await this.claimsRepository.findByPolicyAndType(
      policyId,
      ClaimType.HARVEST_AUTO_SUBMISSION,
    );
    if (existingHarvestClaim) {
      return;
    }

    const resolvedAssessorId = await this.resolveAssessorForPolicy(policy);

    const claim = await this.claimsRepository.create({
      policyId: new Types.ObjectId(policyId),
      farmerId: new Types.ObjectId(farmerId),
      farmId: new Types.ObjectId(farmId),
      lossEventType: LossEventType.HARVEST_END,
      claimType: ClaimType.HARVEST_AUTO_SUBMISSION,
      lossDescription: `Harvest period completed for ${farm.cropType}. Auto-submitted after ${harvestMonths} months from sowing date.`,
      status: ClaimStatus.FILED,
      assessorId: resolvedAssessorId ? new Types.ObjectId(resolvedAssessorId) : undefined,
    });

    if (resolvedAssessorId) {
      const assessment = await this.claimAssessmentsRepository.create({
        claimId: new Types.ObjectId(this.extractId((claim as any)._id)),
        assessorId: new Types.ObjectId(resolvedAssessorId),
      });
      const assessmentDoc = assessment as any;
      await this.claimsRepository.update(this.extractId((claim as any)._id), {
        assessmentReportId: assessmentDoc._id as Types.ObjectId,
        status: ClaimStatus.ASSIGNED,
      });
    }

    this.logger.log(
      `Created harvest auto-claim ${this.extractId((claim as any)._id)} for policy ${policyId}`,
    );
  }

  async assignAssessor(insurerId: string, claimId: string, assessorId: string) {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Claim', claimId);
    }

    // Verify claim belongs to insurer's policy
    const policy = await this.policiesRepository.findById(
      this.extractId(claim.policyId),
    );
    if (this.extractId(policy?.insurerId) !== insurerId) {
      throw new BadRequestException(
        'Claim does not belong to your insurer',
      );
    }

    // Create claim assessment
    const assessment = await this.claimAssessmentsRepository.create({
      claimId: new Types.ObjectId(claimId),
      assessorId: new Types.ObjectId(assessorId),
    });

    const assessmentDoc = assessment as any;
    return this.claimsRepository.update(claimId, {
      assessorId: new Types.ObjectId(assessorId),
      assessmentReportId: assessmentDoc._id as Types.ObjectId,
      status: ClaimStatus.ASSIGNED,
    });
  }

  async updateClaimAssessment(
    assessorId: string,
    claimId: string,
    updateDto: UpdateClaimAssessmentDto,
  ) {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Claim', claimId);
    }

    if (!claim.assessmentReportId) {
      throw new BadRequestException('No assessment report found for this claim');
    }

    const assessment = await this.claimAssessmentsRepository.findById(
      this.extractId(claim.assessmentReportId),
    );
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (this.extractId(assessment.assessorId) !== assessorId) {
      throw new BadRequestException(
        'This assessment is not assigned to you',
      );
    }

    // Perform damage analysis if not already done
    if (!updateDto.ndviBefore || !updateDto.ndviAfter) {
      try {
        const damageAnalysis = await this.damageAnalysisService.analyzeDamage(
          this.extractId(claim.farmId),
          claim.filedAt,
        );

        updateDto.ndviBefore = updateDto.ndviBefore || damageAnalysis.ndviBefore;
        updateDto.ndviAfter = updateDto.ndviAfter || damageAnalysis.ndviAfter;
        updateDto.damageArea =
          updateDto.damageArea || damageAnalysis.estimatedDamageArea;
      } catch (error) {
        // Log error but continue
        console.error('Damage analysis failed:', error);
      }
    }

    const assessmentDoc = assessment as any;
    // Update assessment
    await this.claimAssessmentsRepository.update(
      this.extractId(assessmentDoc._id),
      updateDto,
    );

    // Update claim status
    await this.claimsRepository.update(claimId, {
      status: ClaimStatus.IN_PROGRESS,
    });

    return this.claimAssessmentsRepository.findById(this.extractId(assessmentDoc._id));
  }

  async submitClaimAssessment(assessorId: string, claimId: string) {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim || !claim.assessmentReportId) {
      throw new NotFoundException('Claim or assessment not found');
    }

    const assessment = await this.claimAssessmentsRepository.findById(
      this.extractId(claim.assessmentReportId),
    );
    if (this.extractId(assessment?.assessorId) !== assessorId) {
      throw new BadRequestException('Assessment not assigned to you');
    }

    const assessmentDoc = assessment as any;
    await this.claimAssessmentsRepository.update(this.extractId(assessmentDoc._id), {
      submittedAt: new Date(),
    });

    // Update claim status to SUBMITTED
    await this.claimsRepository.update(claimId, {
      status: ClaimStatus.SUBMITTED,
    });

    return this.claimAssessmentsRepository.findById(this.extractId(assessmentDoc._id));
  }

  async getDamageAnalysis(claimId: string) {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Claim', claimId);
    }

    try {
      return await this.damageAnalysisService.analyzeDamage(
        this.extractId(claim.farmId),
        claim.filedAt,
      );
    } catch (error) {
      this.logger.warn(
        `Damage analysis failed for claim ${claimId}: ${(error as Error)?.message}`,
      );
      return {
        ndviBefore: null,
        ndviAfter: null,
        damagePercentage: null,
        estimatedDamageArea: null,
        error:
          'Satellite-based NDVI comparison could not be computed (EOSDA/field setup). Enter values manually if needed.',
      };
    }
  }

  async approveClaim(insurerId: string, claimId: string, payoutAmount: number) {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Claim', claimId);
    }

    const policy = await this.policiesRepository.findById(
      this.extractId(claim.policyId),
    );
    if (this.extractId(policy?.insurerId) !== insurerId) {
      throw new BadRequestException('Claim does not belong to your insurer');
    }

    // Validate claim status is SUBMITTED
    if (claim.status !== ClaimStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve claim. Current status: ${claim.status}. Only SUBMITTED claims can be approved.`,
      );
    }

    // Update claim
    await this.claimsRepository.update(claimId, {
      status: ClaimStatus.APPROVED,
      payoutAmount,
      decisionDate: new Date(),
    });

    // Create mocked payout
    const payout = await this.payoutsRepository.create({
      claimId: new Types.ObjectId(claimId),
      amount: payoutAmount,
      status: PayoutStatus.APPROVED,
      processedAt: new Date(),
      transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    });

    // Send email notification to farmer
    try {
      const farmer = await this.usersRepository.findById(
        this.extractId(claim.farmerId),
      );
      if (farmer) {
        await this.emailService
          .sendClaimApprovalEmail(
            farmer.email,
            farmer.firstName,
            claimId,
            payoutAmount,
          )
          .catch((error) => {
            console.error(
              `Failed to send claim approval email: ${error.message}`,
            );
          });
      }
    } catch (error) {
      // Log but don't fail claim approval if email fails
      console.error(
        `Failed to send claim approval notification: ${error.message}`,
      );
    }

    return { claim, payout };
  }

  async rejectClaim(
    insurerId: string,
    claimId: string,
    rejectionReason: string,
  ) {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Claim', claimId);
    }

    const policy = await this.policiesRepository.findById(
      this.extractId(claim.policyId),
    );
    if (this.extractId(policy?.insurerId) !== insurerId) {
      throw new BadRequestException('Claim does not belong to your insurer');
    }

    // Validate claim status is SUBMITTED
    if (claim.status !== ClaimStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject claim. Current status: ${claim.status}. Only SUBMITTED claims can be rejected.`,
      );
    }

    await this.claimsRepository.update(claimId, {
      status: ClaimStatus.REJECTED,
      rejectionReason,
      decisionDate: new Date(),
    });

    // Create rejected payout record
    await this.payoutsRepository.create({
      claimId: new Types.ObjectId(claimId),
      amount: 0,
      status: PayoutStatus.REJECTED,
      rejectionReason,
      processedAt: new Date(),
    });

    // Send email notification to farmer
    try {
      const farmer = await this.usersRepository.findById(
        this.extractId(claim.farmerId),
      );
      if (farmer) {
        await this.emailService
          .sendClaimRejectionEmail(
            farmer.email,
            farmer.firstName,
            claimId,
            rejectionReason,
          )
          .catch((error) => {
            console.error(
              `Failed to send claim rejection email: ${error.message}`,
            );
          });
      }
    } catch (error) {
      // Log but don't fail claim rejection if email fails
      console.error(
        `Failed to send claim rejection notification: ${error.message}`,
      );
    }

    return claim;
  }

  async getClaim(claimId: string) {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Claim', claimId);
    }
    return claim;
  }

  async getFarmerClaims(farmerId: string) {
    return this.claimsRepository.findByFarmerId(farmerId);
  }

  async getAssessorClaims(assessorId: string) {
    return this.claimsRepository.findByAssessorId(assessorId);
  }

  async getInsurerClaims(insurerId: string) {
    // Get all policies for this insurer
    const policies = await this.policiesRepository.findByInsurerId(insurerId);
    const policyIds = policies.map((p) => p._id);
    
    // Get all claims for these policies
    const allClaims = await this.claimsRepository.findAll();
    return allClaims.filter(
      (claim) => policyIds.some((id: any) => this.extractId(claim.policyId) === this.extractId(id))
    );
  }

  private extractId(id: any): string {
    if (!id) return '';
    if (typeof id === 'string') return id;
    return id._id ? id._id.toString() : id.toString();
  }

  private async resolveAssessorForPolicy(policy: any): Promise<string | null> {
    const policyId = this.extractId(policy._id);
    const farmId = this.extractId(policy.farmId);

    // 1. Try to find the assessor from the latest crop monitoring (most up-to-date)
    try {
      const policyMonitoring =
        await this.cropMonitoringService.getPolicyMonitoringRecords(policyId);
      if (policyMonitoring.length > 0) {
        const latestMonitoring = policyMonitoring[policyMonitoring.length - 1];
        const assessorId = this.extractId(latestMonitoring.assessorId);
        if (assessorId) {
          this.logger.debug(
            `Resolved assessor ${assessorId} from latest monitoring cycle for policy ${policyId}`,
          );
          return assessorId;
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to check monitoring records for policy ${policyId}: ${error.message}`,
      );
    }

    // 2. Fallback to the specific assessment record linked to or associated with this policy
    if (policy.assessmentId) {
      const assessment = await this.assessmentsRepository.findById(
        this.extractId(policy.assessmentId),
      );
      const assessmentAssessorId = this.extractId(assessment?.assessorId);
      if (assessmentAssessorId) {
        this.logger.debug(
          `Resolved assessor ${assessmentAssessorId} from policy-linked assessment`,
        );
        return assessmentAssessorId;
      }
    }

    // 3. Search for any assessment for this farm as final fallback
    const assessmentByFarm = await this.assessmentsRepository.findByFarmId(farmId);
    const farmAssessorId = this.extractId(assessmentByFarm?.assessorId);
    if (farmAssessorId) {
      this.logger.debug(
        `Resolved assessor ${farmAssessorId} from farm lookup fallback`,
      );
      return farmAssessorId;
    }

    this.logger.warn(`Could not resolve assessor for policy ${policyId}`);
    return null;
  }

  async getAllClaims() {
    return this.claimsRepository.findAll();
  }

  /**
   * Upload drone analysis PDF for a claim assessment
   */
  async uploadDroneAnalysis(
    assessorId: string,
    claimId: string,
    pdfFile: Express.Multer.File,
    pdfType: PdfType,
  ): Promise<any> {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Claim', claimId);
    }
    if (!claim.assessmentReportId) {
      throw new BadRequestException('No assessment report found for this claim');
    }

    const assessment = await this.claimAssessmentsRepository.findById(this.extractId(claim.assessmentReportId));
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const assessmentAssessorId = 
      typeof assessment.assessorId === 'object' && (assessment.assessorId as any)._id
        ? (assessment.assessorId as any)._id.toString()
        : assessment.assessorId.toString();

    if (assessmentAssessorId !== assessorId) {
      throw new BadRequestException('This assessment is not assigned to you');
    }

    if (pdfFile.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const existingPdfs = assessment.droneAnalysisPdfs || [];
    const existingPdf = existingPdfs.find((pdf: any) => pdf.pdfType === pdfType);
    if (existingPdf) {
      throw new BadRequestException(`A ${pdfType.replace('_', ' ')} PDF has already been uploaded for this claim`);
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
    const filename = `${pdfType}-claim-${claimId}-${timestamp}-${randomStr}.pdf`;
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
      console.log(`Calling drone analysis service for: ${absoluteFilePath}`);
      const analysisResult = await this.droneAnalysisService.extractDroneData(absoluteFilePath);
      
      if (analysisResult.success && analysisResult.extractedData) {
        droneAnalysisData = analysisResult.extractedData;
      }
    } catch (error: any) {
      console.error(`Failed to extract drone data: ${error.message}`);
    }

    const newPdfEntry = {
      pdfType,
      pdfUrl,
      droneAnalysisData,
      uploadedAt: new Date(),
    };

    const updatedPdfs = [...existingPdfs, newPdfEntry];
    const updatedAssessment = await this.claimAssessmentsRepository.update(this.extractId(claim.assessmentReportId), {
      droneAnalysisPdfs: updatedPdfs,
    });

    return {
      claimId,
      pdfType,
      pdfUrl,
      droneAnalysisData,
      assessment: updatedAssessment,
    };
  }

  /**
   * Get all uploaded PDFs for a claim
   */
  async getUploadedPdfs(claimId: string): Promise<any> {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Claim', claimId);
    }
    if (!claim.assessmentReportId) {
      return [];
    }
    const assessment = await this.claimAssessmentsRepository.findById(this.extractId(claim.assessmentReportId));
    if (!assessment) {
      return [];
    }
    return assessment.droneAnalysisPdfs || [];
  }

  /**
   * Delete a specific PDF from a claim
   */
  async deletePdf(assessorId: string, claimId: string, pdfType: PdfType): Promise<any> {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Claim', claimId);
    }
    if (!claim.assessmentReportId) {
      throw new BadRequestException('No assessment report found for this claim');
    }

    const assessment = await this.claimAssessmentsRepository.findById(this.extractId(claim.assessmentReportId));
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const assessmentAssessorId = 
      typeof assessment.assessorId === 'object' && (assessment.assessorId as any)._id
        ? (assessment.assessorId as any)._id.toString()
        : assessment.assessorId.toString();

    if (assessmentAssessorId !== assessorId) {
      throw new BadRequestException('This assessment is not assigned to you');
    }

    const existingPdfs = assessment.droneAnalysisPdfs || [];
    const pdfIndex = existingPdfs.findIndex((pdf: any) => pdf.pdfType === pdfType);

    if (pdfIndex === -1) {
      throw new BadRequestException(`No ${pdfType.replace('_', ' ')} PDF found for this claim`);
    }

    const fs = require('fs');
    const path = require('path');
    const pdfToDelete = existingPdfs[pdfIndex];
    const filePath = path.join('.', pdfToDelete.pdfUrl);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const updatedPdfs = existingPdfs.filter((pdf: any) => pdf.pdfType !== pdfType);

    const updatedAssessment = await this.claimAssessmentsRepository.update(this.extractId(claim.assessmentReportId), {
      droneAnalysisPdfs: updatedPdfs,
    });

    return {
      claimId,
      pdfType,
      message: `${pdfType.replace('_', ' ')} PDF deleted successfully`,
      assessment: updatedAssessment,
    };
  }
}

