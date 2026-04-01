import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { UsersRepository } from '../users/users.repository';
import { AgromonitoringService } from '../agromonitoring/agromonitoring.service';
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
    private readonly agromonitoringService: AgromonitoringService,
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

  async getAllPoliciesList() {
    return this.policiesRepository.findAll();
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

  /**
   * Live probes: MongoDB, AGROmonitoring weather, AGRO field API (EOSDA-compatible registry),
   * local uploads storage size, Node heap / RSS.
   */
  async getSystemHealth() {
    const checkedAt = new Date().toISOString();

    const [database, agromonitoring, eosdaFields, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkAgromonitoringWeather(),
      this.checkEosdaFieldsApi(),
      Promise.resolve(this.checkStorage()),
    ]);

    const mem = process.memoryUsage();
    const processInfo = {
      heapUsedMb: this.roundMb(mem.heapUsed),
      heapTotalMb: this.roundMb(mem.heapTotal),
      rssMb: this.roundMb(mem.rss),
      externalMb: this.roundMb(mem.external),
    };

    const components = [database, agromonitoring, eosdaFields, storage];
    const ok = components.filter((c) => c.status === 'ok').length;
    const hasError = components.some((c) => c.status === 'error');
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (hasError) {
      overall = 'unhealthy';
    } else if (ok === components.length) {
      overall = 'healthy';
    } else {
      overall = 'degraded';
    }

    return {
      checkedAt,
      overall,
      database,
      agromonitoring,
      eosdaFields,
      storage,
      process: processInfo,
    };
  }

  private roundMb(bytes: number): number {
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
  }

  private async checkDatabase(): Promise<{
    status: 'ok' | 'error';
    latencyMs?: number;
    detail?: string;
  }> {
    const start = Date.now();
    try {
      const nativeDb = this.userModel.db.db;
      if (!nativeDb) {
        return { status: 'error', detail: 'Database handle not available' };
      }
      await nativeDb.admin().command({ ping: 1 });
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (e: any) {
      return { status: 'error', detail: e?.message || 'Ping failed' };
    }
  }

  private async checkAgromonitoringWeather(): Promise<{
    status: 'ok' | 'error';
    latencyMs?: number;
    detail?: string;
  }> {
    const start = Date.now();
    try {
      await this.agromonitoringService.weather.getWeatherForecast(-1.94, 29.87);
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (e: any) {
      return {
        status: 'error',
        detail: this.truncateDetail(e?.message || String(e)),
      };
    }
  }

  /** Field list uses same AGRO / EOSDA-compatible API as farm registration. */
  private async checkEosdaFieldsApi(): Promise<{
    status: 'ok' | 'error';
    latencyMs?: number;
    fieldCount?: number;
    detail?: string;
  }> {
    const start = Date.now();
    try {
      const fields = await this.agromonitoringService.fieldManagement.getAllFields();
      const fieldCount = Array.isArray(fields) ? fields.length : 0;
      return { status: 'ok', latencyMs: Date.now() - start, fieldCount };
    } catch (e: any) {
      return {
        status: 'error',
        detail: this.truncateDetail(e?.message || String(e)),
      };
    }
  }

  private checkStorage(): {
    status: 'ok' | 'error';
    uploadsPath: string;
    usedBytes?: number;
    usedLabel?: string;
    detail?: string;
  } {
    const uploadsPath = path.join(process.cwd(), 'uploads');
    try {
      if (!fs.existsSync(uploadsPath)) {
        return {
          status: 'ok',
          uploadsPath,
          usedBytes: 0,
          usedLabel: '0 B',
          detail: 'Folder not created yet (no uploads)',
        };
      }
      const usedBytes = this.directorySizeBytes(uploadsPath);
      return {
        status: 'ok',
        uploadsPath,
        usedBytes,
        usedLabel: this.formatBytes(usedBytes),
      };
    } catch (e: any) {
      return {
        status: 'error',
        uploadsPath,
        detail: e?.message || 'Could not read uploads',
      };
    }
  }

  private directorySizeBytes(dir: string): number {
    let size = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          size += this.directorySizeBytes(full);
        } else {
          size += fs.statSync(full).size;
        }
      } catch {
        // skip unreadable entries
      }
    }
    return size;
  }

  private formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  private truncateDetail(s: string, max = 240): string {
    if (!s) return '';
    return s.length <= max ? s : `${s.slice(0, max)}…`;
  }
}

