import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PoliciesRepository } from './policies.repository';
import { AssessmentsRepository } from '../assessments/assessments.repository';
import { FarmsRepository } from '../farms/farms.repository';
import { UsersRepository } from '../users/users.repository';
import { RiskScoringService } from '../assessments/services/risk-scoring.service';
import { EmailService } from '../email/email.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { PolicyStatus } from './schemas/policy.schema';

@Injectable()
export class PoliciesService {
  constructor(
    private policiesRepository: PoliciesRepository,
    private assessmentsRepository: AssessmentsRepository,
    private farmsRepository: FarmsRepository,
    private usersRepository: UsersRepository,
    private riskScoringService: RiskScoringService,
    private emailService: EmailService,
  ) {}

  async issuePolicy(insurerId: string, createDto: CreatePolicyDto) {
    const assessment = await this.assessmentsRepository.findById(createDto.assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment', createDto.assessmentId);
    }

    // Assessment must have an insurerId to issue a policy
    if (!assessment.insurerId) {
      throw new BadRequestException(
        'This assessment does not have an insurer assigned. Policies can only be issued for insurer-assigned assessments.',
      );
    }

    // Extract insurer ID from assessment (handle both ObjectId and user object cases)
    let assessmentInsurerId: string;

    if (!assessment.insurerId) {
      throw new BadRequestException('Invalid insurerId format in assessment');
    }

    // Handle case where insurerId is stored as user object (incorrectly)
    if (typeof assessment.insurerId === 'object' && assessment.insurerId !== null) {
      const insurerObj = assessment.insurerId as any;
      // If insurerId is a user object, extract the _id
      if (insurerObj._id) {
        assessmentInsurerId = insurerObj._id.toString();
      } else if (insurerObj.id) {
        assessmentInsurerId = insurerObj.id.toString();
      } else {
        throw new BadRequestException('Invalid insurerId format in assessment');
      }
    } else {
      // If insurerId is already a string or ObjectId
      assessmentInsurerId = (assessment.insurerId as any).toString();
    }

    if (assessmentInsurerId !== insurerId) {
      throw new BadRequestException('This assessment does not belong to your insurer');
    }

    if (assessment.status !== 'SUBMITTED') {
      throw new BadRequestException('Assessment must be submitted first');
    }

    // Extract farm ID from assessment (handle both ObjectId and farm object cases)
    let assessmentFarmId: string;
    if (typeof assessment.farmId === 'object' && assessment.farmId !== null) {
      const farmObj = assessment.farmId as any;
      if (farmObj._id) {
        assessmentFarmId = farmObj._id.toString();
      } else if (farmObj.id) {
        assessmentFarmId = farmObj.id.toString();
      } else {
        throw new BadRequestException('Invalid farmId format in assessment');
      }
    } else {
      assessmentFarmId = (assessment.farmId as any).toString();
    }

    const farm = await this.farmsRepository.findById(assessmentFarmId);
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    // Calculate premium based on risk score and area
    const premiumAmount = this.riskScoringService.calculatePremium(
      assessment.riskScore || 50,
      farm.area || 1,
    );

    const policyNumber = this.policiesRepository.generatePolicyNumber();

    const policy = await this.policiesRepository.create({
      farmerId: farm.farmerId as Types.ObjectId,
      farmId: farm._id as any as Types.ObjectId,
      insurerId: new Types.ObjectId(insurerId),
      assessmentId: assessment._id as any as Types.ObjectId,
      policyNumber,
      coverageLevel: createDto.coverageLevel || 'STANDARD',
      premiumAmount,
      startDate: createDto.startDate,
      endDate: createDto.endDate,
      status: PolicyStatus.ACTIVE,
    });

    // Update farm status to INSURED
    const farmId = farm._id as any;
    await this.farmsRepository.update(farmId.toString(), {
      status: 'INSURED' as any,
    });

    // Send email notification to farmer
    try {
      const farmer = await this.usersRepository.findById(farm.farmerId.toString());

      if (farmer) {
        const startDateStr =
          createDto.startDate instanceof Date
            ? createDto.startDate.toISOString().split('T')[0]
            : new Date(createDto.startDate).toISOString().split('T')[0];
        const endDateStr =
          createDto.endDate instanceof Date
            ? createDto.endDate.toISOString().split('T')[0]
            : new Date(createDto.endDate).toISOString().split('T')[0];

        await this.emailService
          .sendPolicyIssuanceEmail(
            farmer.email,
            farmer.firstName,
            policyNumber,
            premiumAmount,
            startDateStr,
            endDateStr,
          )
          .catch(error => {
            console.error(`Failed to send policy issuance email: ${error.message}`);
          });
      }
    } catch (error) {
      // Log but don't fail policy issuance if email fails
      console.error(`Failed to send policy issuance notification: ${error.message}`);
    }

    return policy;
  }

  async getPolicy(policyId: string) {
    const policy = await this.policiesRepository.findById(policyId);
    if (!policy) {
      throw new NotFoundException('Policy', policyId);
    }
    return policy;
  }

  async getFarmerPolicies(farmerId: string) {
    return this.policiesRepository.findByFarmerId(farmerId);
  }

  async getInsurerPolicies(insurerId: string) {
    return this.policiesRepository.findByInsurerId(insurerId);
  }

  /**
   * Assessor can only see policies for farms assigned to them.
   * This enables the crop monitoring workflow (start up to 2 cycles per policy).
   */
  async getAssessorPolicies(assessorId: string) {
    const assessments = await this.assessmentsRepository.findByAssessorId(assessorId);

    const farmIds = assessments
      .map((a: any) => {
        const farmId = a.farmId as any;
        if (!farmId) return null;
        return farmId._id ? farmId._id.toString() : farmId.toString();
      })
      .filter((id: string | null): id is string => !!id);

    if (farmIds.length === 0) return [];

    // Policies are stored by farmId, so filter by assigned farm IDs.
    // (We do not restrict to ACTIVE here; frontend can filter, and allowing
    // visibility helps debugging/history views.)
    return this.policiesRepository.findAll({
      farmId: { $in: farmIds.map(id => new Types.ObjectId(id)) },
    });
  }
}
