import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Claim } from '../claims/schemas/claim.schema';
import { Policy } from '../policies/schemas/policy.schema';
import { User } from '../users/schemas/user.schema';
import { Role } from '../users/enums/role.enum';
import { ClaimStatus } from '../claims/enums/claim-status.enum';

@Injectable()
export class InsurerService {
  constructor(
    @InjectModel(Claim.name) private claimModel: Model<Claim>,
    @InjectModel(Policy.name) private policyModel: Model<Policy>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async getDashboardStats(insurerId: string) {
    const insurerObjectId = new Types.ObjectId(insurerId);

    // Get all policy IDs for this insurer
    const policies = await this.policyModel.find({ insurerId: insurerObjectId }).exec();
    const policyIds = policies.map(p => p._id);

    const [openClaims, submittedToday, activePolicies, totalAssessors, recentClaims] =
      await Promise.all([
        // Open claims: FILED, ASSIGNED, IN_PROGRESS, SUBMITTED
        this.claimModel
          .countDocuments({
            policyId: { $in: policyIds },
            status: {
              $in: [
                ClaimStatus.FILED,
                ClaimStatus.ASSIGNED,
                ClaimStatus.IN_PROGRESS,
                ClaimStatus.SUBMITTED,
              ],
            },
          })
          .exec(),

        // Submitted today
        this.claimModel
          .countDocuments({
            policyId: { $in: policyIds },
            filedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          })
          .exec(),

        // Active policies
        this.policyModel
          .countDocuments({
            insurerId: insurerObjectId,
            status: 'ACTIVE',
          })
          .exec(),

        // Total assessors
        this.userModel
          .countDocuments({
            role: Role.ASSESSOR,
          })
          .exec(),

        // Priority queue (latest 5 claims)
        this.claimModel
          .find({
            policyId: { $in: policyIds },
          })
          .sort({ filedAt: -1 })
          .limit(5)
          .populate('farmId', 'name')
          .exec(),
      ]);

    return {
      stats: {
        openClaims,
        submittedToday,
        activePolicies,
        assessorsOnline: totalAssessors, // Using total as proxy for now
      },
      priorityQueue: recentClaims.map((c: any) => ({
        id: c._id,
        farm: c.farmId?.name || 'Unknown Farm',
        event: c.lossEventType,
        status: c.status,
        createdAt: c.filedAt,
      })),
    };
  }

  async getReports(insurerId: string) {
    const insurerObjectId = new Types.ObjectId(insurerId);

    // Get all policies for this insurer
    const policies = await this.policyModel
      .find({ insurerId: insurerObjectId })
      .populate('farmerId')
      .exec();

    const policyIds = policies.map(p => p._id);

    // Get all claims for these policies
    const claims = await this.claimModel.find({ policyId: { $in: policyIds } }).exec();

    // Portfolio Summary
    const totalPremium = policies.reduce((sum, p) => sum + (p.premiumAmount || 0), 0);
    const activePolicies = policies.filter(p => p.status === 'ACTIVE').length;
    const totalPolicies = policies.length;

    // Claims Summary
    const totalClaims = claims.length;
    const approvedClaims = claims.filter(c => c.status === ClaimStatus.APPROVED);
    const totalPayout = approvedClaims.reduce((sum, c) => sum + (c.payoutAmount || 0), 0);
    const approvedCount = approvedClaims.length;
    const rejectedClaims = claims.filter(c => c.status === ClaimStatus.REJECTED).length;
    const pendingClaims = claims.filter(c =>
      [
        ClaimStatus.FILED,
        ClaimStatus.ASSIGNED,
        ClaimStatus.IN_PROGRESS,
        ClaimStatus.SUBMITTED,
      ].includes(c.status),
    ).length;

    // Regional distribution (using farmerId's province)
    const regionalData = policies.reduce((acc: any, p: any) => {
      const region = p.farmerId?.province || 'Other';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {});

    // Monthly trends (last 6 months)
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return {
        month: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        monthNum: d.getMonth(),
      };
    }).reverse();

    const monthlyTrends = last6Months.map(({ month, year, monthNum }) => {
      const policyCount = policies.filter(p => {
        const d = p.issuedAt || (p as any).createdAt;
        return d && d.getMonth() === monthNum && d.getFullYear() === year;
      }).length;

      const claimCount = claims.filter(c => {
        const d = c.filedAt;
        return d && d.getMonth() === monthNum && d.getFullYear() === year;
      }).length;

      return {
        month,
        policies: policyCount,
        claims: claimCount,
      };
    });

    return {
      summary: {
        totalPremium,
        activePolicies,
        totalPolicies,
        totalClaims,
        approvedClaims: approvedCount,
        rejectedClaims,
        pendingClaims,
        lossRatio: totalPremium > 0 ? ((totalPayout / totalPremium) * 100).toFixed(2) : 0,
      },
      regionalDistribution: Object.entries(regionalData).map(([name, value]) => ({ name, value })),
      monthlyTrends,
    };
  }
}
