import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { FarmsRepository } from '../farms/farms.repository';
import { PoliciesRepository } from '../policies/policies.repository';
import { ClaimsRepository } from '../claims/claims.repository';
import { AssessmentsRepository } from '../assessments/assessments.repository';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { Farm } from '../farms/schemas/farm.schema';
import { Policy } from '../policies/schemas/policy.schema';
import { Claim } from '../claims/schemas/claim.schema';
import { Assessment } from '../assessments/schemas/assessment.schema';

@Injectable()
export class AdminService {
  constructor(
    private usersRepository: UsersRepository,
    private farmsRepository: FarmsRepository,
    private policiesRepository: PoliciesRepository,
    private claimsRepository: ClaimsRepository,
    private assessmentsRepository: AssessmentsRepository,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Farm.name) private farmModel: Model<Farm>,
    @InjectModel(Policy.name) private policyModel: Model<Policy>,
    @InjectModel(Claim.name) private claimModel: Model<Claim>,
    @InjectModel(Assessment.name) private assessmentModel: Model<Assessment>,
  ) {}

  async getSystemStatistics() {
    const [
      totalUsers,
      totalFarms,
      totalPolicies,
      totalClaims,
      totalAssessments,
      activePolicies,
      activeClaims,
      usersByRole,
      policiesByStatus,
      claimsByStatus,
    ] = await Promise.all([
      this.userModel.countDocuments({}).exec(),
      this.farmModel.countDocuments({}).exec(),
      this.policyModel.countDocuments({}).exec(),
      this.claimModel.countDocuments({}).exec(),
      this.assessmentModel.countDocuments({}).exec(),
      this.policyModel.countDocuments({ status: 'ACTIVE' }).exec(),
      this.claimModel.countDocuments({ status: { $in: ['FILED', 'ASSIGNED', 'IN_PROGRESS'] } }).exec(),
      this.userModel.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]).exec(),
      this.policyModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).exec(),
      this.claimModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).exec(),
    ]);

    return {
      overview: {
        totalUsers,
        totalFarms,
        totalPolicies,
        totalClaims,
        totalAssessments,
        activePolicies,
        activeClaims,
      },
      usersByRole: usersByRole.reduce(
        (acc, item) => ({ ...acc, [item._id]: item.count }),
        {},
      ),
      policiesByStatus: policiesByStatus.reduce(
        (acc, item) => ({ ...acc, [item._id]: item.count }),
        {},
      ),
      claimsByStatus: claimsByStatus.reduce(
        (acc, item) => ({ ...acc, [item._id]: item.count }),
        {},
      ),
    };
  }

  async getPolicyOverview() {
    const policies = await this.policiesRepository.findAll();

    const totalPremium = policies.reduce(
      (sum, policy) => sum + (policy.premiumAmount || 0),
      0,
    );

    const activePolicies = policies.filter((p) => p.status === 'ACTIVE');
    const expiredPolicies = policies.filter((p) => p.status === 'EXPIRED');

    return {
      total: policies.length,
      active: activePolicies.length,
      expired: expiredPolicies.length,
      totalPremium,
      averagePremium: policies.length > 0 ? totalPremium / policies.length : 0,
    };
  }

  async getClaimStatistics() {
    const claims = await this.claimModel.find({}).exec();

    const totalClaims = claims.length;
    const approvedClaims = claims.filter((c) => c.status === 'APPROVED');
    const rejectedClaims = claims.filter((c) => c.status === 'REJECTED');
    const pendingClaims = claims.filter((c) =>
      ['FILED', 'ASSIGNED', 'IN_PROGRESS'].includes(c.status),
    );

    const totalPayout = approvedClaims.reduce(
      (sum, claim) => sum + (claim.payoutAmount || 0),
      0,
    );

    const averagePayout =
      approvedClaims.length > 0 ? totalPayout / approvedClaims.length : 0;

    return {
      total: totalClaims,
      approved: approvedClaims.length,
      rejected: rejectedClaims.length,
      pending: pendingClaims.length,
      totalPayout,
      averagePayout,
      approvalRate:
        totalClaims > 0
          ? (approvedClaims.length / totalClaims) * 100
          : 0,
    };
  }
}

