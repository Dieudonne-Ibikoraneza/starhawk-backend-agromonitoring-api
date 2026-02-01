import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ClaimsRepository } from './claims.repository';
import { ClaimAssessmentsRepository } from './claim-assessments.repository';
import { PayoutsRepository } from './payouts.repository';
import { PoliciesRepository } from '../policies/policies.repository';
import { UsersRepository } from '../users/users.repository';
import { EmailService } from '../email/email.service';
import { DamageAnalysisService } from './services/damage-analysis.service';
import { CreateClaimDto } from './dto/create-claim.dto';
import { UpdateClaimAssessmentDto } from './dto/update-claim-assessment.dto';
import { ClaimStatus } from './enums/claim-status.enum';
import { PayoutStatus } from './schemas/payout.schema';

@Injectable()
export class ClaimsService {
  constructor(
    private claimsRepository: ClaimsRepository,
    private claimAssessmentsRepository: ClaimAssessmentsRepository,
    private payoutsRepository: PayoutsRepository,
    private policiesRepository: PoliciesRepository,
    private usersRepository: UsersRepository,
    private emailService: EmailService,
    private damageAnalysisService: DamageAnalysisService,
  ) {}

  async fileClaim(farmerId: string, createDto: CreateClaimDto) {
    // Verify policy belongs to farmer
    const policy = await this.policiesRepository.findById(createDto.policyId);
    if (!policy) {
      throw new NotFoundException('Policy', createDto.policyId);
    }

    if (policy.farmerId.toString() !== farmerId) {
      throw new BadRequestException('Policy does not belong to this farmer');
    }

    // Verify policy is active
    if (policy.status !== 'ACTIVE') {
      throw new BadRequestException('Policy is not active');
    }

    const claim = await this.claimsRepository.create({
      policyId: new Types.ObjectId(createDto.policyId),
      farmerId: new Types.ObjectId(farmerId),
      farmId: policy.farmId as Types.ObjectId,
      lossEventType: createDto.lossEventType,
      lossDescription: createDto.lossDescription,
      damagePhotos: createDto.damagePhotos,
      status: ClaimStatus.FILED,
    });

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
            createDto.lossEventType,
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

  async assignAssessor(insurerId: string, claimId: string, assessorId: string) {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Claim', claimId);
    }

    // Verify claim belongs to insurer's policy
    const policy = await this.policiesRepository.findById(
      claim.policyId.toString(),
    );
    if (policy?.insurerId.toString() !== insurerId) {
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
      claim.assessmentReportId.toString(),
    );
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.assessorId.toString() !== assessorId) {
      throw new BadRequestException(
        'This assessment is not assigned to you',
      );
    }

    // Perform damage analysis if not already done
    if (!updateDto.ndviBefore || !updateDto.ndviAfter) {
      try {
        const damageAnalysis = await this.damageAnalysisService.analyzeDamage(
          claim.farmId.toString(),
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
      assessmentDoc._id.toString(),
      updateDto,
    );

    // Update claim status
    await this.claimsRepository.update(claimId, {
      status: ClaimStatus.IN_PROGRESS,
    });

    return this.claimAssessmentsRepository.findById(assessmentDoc._id.toString());
  }

  async submitClaimAssessment(assessorId: string, claimId: string) {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim || !claim.assessmentReportId) {
      throw new NotFoundException('Claim or assessment not found');
    }

    const assessment = await this.claimAssessmentsRepository.findById(
      claim.assessmentReportId.toString(),
    );
    if (assessment?.assessorId.toString() !== assessorId) {
      throw new BadRequestException('Assessment not assigned to you');
    }

    const assessmentDoc = assessment as any;
    await this.claimAssessmentsRepository.update(assessmentDoc._id.toString(), {
      submittedAt: new Date(),
    });

    return assessment;
  }

  async approveClaim(insurerId: string, claimId: string, payoutAmount: number) {
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Claim', claimId);
    }

    const policy = await this.policiesRepository.findById(
      claim.policyId.toString(),
    );
    if (policy?.insurerId.toString() !== insurerId) {
      throw new BadRequestException('Claim does not belong to your insurer');
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
        claim.farmerId.toString(),
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
      claim.policyId.toString(),
    );
    if (policy?.insurerId.toString() !== insurerId) {
      throw new BadRequestException('Claim does not belong to your insurer');
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
        claim.farmerId.toString(),
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
      (claim) => policyIds.some((id: string) => claim.policyId?.toString() === id.toString())
    );
  }

  async getAllClaims() {
    return this.claimsRepository.findAll();
  }
}

