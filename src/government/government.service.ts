import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Region, RegionDocument } from './schemas/region.schema';
import { DailyAggregation, DailyAggregationDocument } from './schemas/daily-aggregation.schema';
import { GovernmentProfile, GovernmentProfileDocument } from '../users/schemas/government-profile.schema';
import { FarmerProfile, FarmerProfileDocument } from '../users/schemas/farmer-profile.schema';
import { Farm, FarmDocument } from '../farms/schemas/farm.schema';
import { Policy, PolicyDocument, PolicyStatus } from '../policies/schemas/policy.schema';
import { Claim, ClaimDocument } from '../claims/schemas/claim.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ClaimStatus } from '../claims/enums/claim-status.enum';

/** Map a GovernmentLevel string to the FarmerProfile location field */
function levelToFarmerField(level: string): string | null {
  const map: Record<string, string> = {
    PROVINCE: 'farmProvince',
    DISTRICT: 'farmDistrict',
    SECTOR: 'farmSector',
    CELL: 'farmCell',
    VILLAGE: 'farmVillage',
  };
  return map[level] ?? null;
}

/** Build a mongo match query targeting farmers whose location matches the region */
function farmerMatchForRegion(region: RegionDocument): Record<string, any> {
  const field = levelToFarmerField(region.level);
  if (!field) return {}; // COUNTRY → no filter, all farmers
  return { [field]: region.name };
}

@Injectable()
export class GovernmentService {
  constructor(
    @InjectModel(Region.name) private regionModel: Model<RegionDocument>,
    @InjectModel(DailyAggregation.name) private dailyAggModel: Model<DailyAggregationDocument>,
    @InjectModel(GovernmentProfile.name) private govProfileModel: Model<GovernmentProfileDocument>,
    @InjectModel(FarmerProfile.name) private farmerProfileModel: Model<FarmerProfileDocument>,
    @InjectModel(Farm.name) private farmModel: Model<FarmDocument>,
    @InjectModel(Policy.name) private policyModel: Model<PolicyDocument>,
    @InjectModel(Claim.name) private claimModel: Model<ClaimDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  // ─── Hierarchy path helpers ──────────────────────────────────────────────

  private sanitizeId(name: string): string {
    return name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || '';
  }

  private buildUserHierarchyPath(profile: GovernmentProfileDocument): string {
    if (profile.hierarchyPath) return profile.hierarchyPath;

    let path = '/rwanda';
    if (profile.level === 'COUNTRY') return path;
    if (profile.province) path += `/prov-${this.sanitizeId(profile.province)}`;
    if (profile.level === 'PROVINCE') return path;
    if (profile.district) path += `/dist-${this.sanitizeId(profile.district)}`;
    if (profile.level === 'DISTRICT') return path;
    if (profile.sector) path += `/sect-${this.sanitizeId(profile.district || '')}-${this.sanitizeId(profile.sector)}`;
    if (profile.level === 'SECTOR') return path;
    if (profile.cell) path += `/cell-${this.sanitizeId(profile.sector || '')}-${this.sanitizeId(profile.cell)}`;
    if (profile.level === 'CELL') return path;
    if (profile.village) path += `/vill-${this.sanitizeId(profile.cell || '')}-${this.sanitizeId(profile.village)}`;
    return path;
  }

  // ─── Access guard ────────────────────────────────────────────────────────

  async verifyRegionAccess(userId: string, requestedRegionId: string): Promise<boolean> {
    const profile = await this.govProfileModel.findOne({ userId }).exec();
    if (!profile) return false;

    const userPath = this.buildUserHierarchyPath(profile);

    if (requestedRegionId === 'rwanda') {
      return userPath === '/rwanda';
    }

    const requestedRegion = await this.regionModel.findOne({ regionId: requestedRegionId }).exec();
    if (!requestedRegion) {
      throw new NotFoundException('Requested region not found');
    }

    return requestedRegion.hierarchyPath.startsWith(userPath);
  }

  // ─── Core shared helpers ─────────────────────────────────────────────────

  /**
   * Given a region, returns the ObjectIds of all farmers registered in that region.
   *
   * - COUNTRY  → all farmers (no filter)
   * - PROVINCE → match by child district names (avoids Kinyarwanda/English name mismatch
   *              between the region tree and the legacy farmProvince field on profiles)
   * - DISTRICT / SECTOR / CELL / VILLAGE → direct name match on the corresponding field
   */
  private async getFarmerUserIdsForRegion(region: RegionDocument): Promise<Types.ObjectId[]> {
    if (!region.level || region.level === 'COUNTRY') {
      // No filter → every farmer in Rwanda
      const profiles = await this.farmerProfileModel.find({}, { userId: 1 }).lean().exec();
      return profiles.map((p) => new Types.ObjectId(p.userId.toString()));
    }

    if (region.level === 'PROVINCE') {
      // Get the English district names that belong to this province, then match farmers
      // by their farmDistrict field (which uses the same district names as our region tree).
      const districts = await this.regionModel
        .find({ parentId: region.regionId }, { name: 1 })
        .lean()
        .exec();
      const districtNames = districts.map((d) => d.name);
      if (!districtNames.length) return [];
      const profiles = await this.farmerProfileModel
        .find({ farmDistrict: { $in: districtNames } }, { userId: 1 })
        .lean()
        .exec();
      return profiles.map((p) => new Types.ObjectId(p.userId.toString()));
    }

    // DISTRICT / SECTOR / CELL / VILLAGE — direct field match
    const match = farmerMatchForRegion(region);
    const profiles = await this.farmerProfileModel.find(match, { userId: 1 }).lean().exec();
    return profiles.map((p) => new Types.ObjectId(p.userId.toString()));
  }

  /**
   * Returns crop breakdown (ha per crop) for farmers in a region.
   * Dominance / least-cultivated is derived from total area per crop.
   */
  private async getCropBreakdownForFarmers(farmerIds: Types.ObjectId[]) {
    if (!farmerIds.length) return [];

    const agg = await this.farmModel.aggregate([
      { $match: { farmerId: { $in: farmerIds } } },
      {
        $group: {
          _id: '$cropType',
          totalHa: { $sum: { $ifNull: ['$area', 0] } },
          farmCount: { $sum: 1 },
        },
      },
      { $sort: { totalHa: -1 } },
    ]);

    return agg.map((r) => ({
      crop: r._id as string,
      totalHa: Math.round(r.totalHa * 100) / 100,
      farmCount: r.farmCount as number,
    }));
  }

  /**
   * Returns total cultivated area (ha) for a set of farmers.
   */
  private async getTotalCultivatedHa(farmerIds: Types.ObjectId[]): Promise<number> {
    if (!farmerIds.length) return 0;
    const agg = await this.farmModel.aggregate([
      { $match: { farmerId: { $in: farmerIds } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$area', 0] } } } },
    ]);
    return agg.length ? Math.round((agg[0].total as number) * 100) / 100 : 0;
  }

  /**
   * Counts unique farmers who have at least one ACTIVE policy.
   */
  private async getUniqueInsuredFarmersCount(farmerIds: Types.ObjectId[]): Promise<number> {
    if (!farmerIds.length) return 0;
    const uniqueFarmers = await this.policyModel.distinct('farmerId', {
      farmerId: { $in: farmerIds },
      status: PolicyStatus.ACTIVE,
    });
    return uniqueFarmers.length;
  }

  /**
   * Counts ACTIVE policies for farmers in a region.
   */
  private async getActivePolicyCount(farmerIds: Types.ObjectId[]): Promise<number> {
    if (!farmerIds.length) return 0;
    return this.policyModel.countDocuments({
      farmerId: { $in: farmerIds },
      status: PolicyStatus.ACTIVE,
    });
  }

  /**
   * Counts active (FILED / UNDER_REVIEW) claims for farmers in a region.
   */
  private async getActiveClaimCount(farmerIds: Types.ObjectId[]): Promise<number> {
    if (!farmerIds.length) return 0;
    return this.claimModel.countDocuments({
      farmerId: { $in: farmerIds },
      status: { $in: [ClaimStatus.FILED, ClaimStatus.ASSIGNED, ClaimStatus.IN_PROGRESS, ClaimStatus.SUBMITTED] },
    });
  }

  // ─── Main leaderboard endpoint ───────────────────────────────────────────

  /**
   * Comprehensive leaderboard snapshot for a region.
   *
   * Returns:
   *  • Region info (name, level)
   *  • Registered farmers (name, email, phone)
   *  • Total registered farmers count
   *  • Total active policies & insurance %
   *  • Active claims count
   *  • Total cultivated area (ha)
   *  • Crop breakdown (ha per crop, dominant / least crop)
   *  • NDVI + 7-day / 30-day changes
   *  • Sub-regions (next level) with: name, farmerCount, next-level count, sub-sub-region names, cultivatedHa, insuredCount, NDVI
   */
  async getRegionLeaderboard(regionId: string) {
    // ── 1. Resolve the region ──────────────────────────────────────────────
    const region = await this.regionModel.findOne({ regionId }).lean().exec();
    if (!region) throw new NotFoundException(`Region '${regionId}' not found`);

    // ── 2. Get all farmers in this region ─────────────────────────────────
    const farmerIds = await this.getFarmerUserIdsForRegion(region as any);
    const totalFarmers = farmerIds.length;

    // ── 3. Farmer list (lightweight) ─────────────────────────────────────
    const farmerUsers = await this.userModel
      .find({ _id: { $in: farmerIds } }, { firstName: 1, lastName: 1, email: 1, phoneNumber: 1 })
      .lean()
      .exec();

    const farmers = farmerUsers.map((u) => ({
      id: (u as any)._id.toString(),
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      phone: u.phoneNumber,
    }));

    // ── 4. Insurance & claims ─────────────────────────────────────────────
    const [activePolicies, uniqueInsuredFarmers, activeClaims] = await Promise.all([
      this.getActivePolicyCount(farmerIds),
      this.getUniqueInsuredFarmersCount(farmerIds),
      this.getActiveClaimCount(farmerIds),
    ]);

    const insurancePercent =
      totalFarmers > 0 ? Math.round((uniqueInsuredFarmers / totalFarmers) * 100) : 0;

    // ── 5. Crop breakdown ─────────────────────────────────────────────────
    const cropBreakdown = await this.getCropBreakdownForFarmers(farmerIds);
    const totalCultivatedHa = cropBreakdown.reduce((s, c) => s + c.totalHa, 0);
    const dominantCrop = cropBreakdown[0] ?? null;
    const leastCrop = cropBreakdown[cropBreakdown.length - 1] ?? null;

    // ── 6. NDVI (from DailyAggregation) + 7-day / 30-day change ──────────
    const ndviHistory = await this.dailyAggModel
      .find({ regionId })
      .sort({ date: -1 })
      .limit(31)
      .lean()
      .exec();

    // Default NDVI for Rwanda when no satellite data is ingested yet (healthy vegetation baseline)
    const DEFAULT_NDVI = 0.65;
    const currentNdvi = ndviHistory[0]?.metrics?.ndvi || DEFAULT_NDVI;
    const ndvi7dAgo = ndviHistory[6]?.metrics?.ndvi ?? null;
    const ndvi30dAgo = ndviHistory[29]?.metrics?.ndvi ?? null;

    // Fall back to 0 (no change) rather than null so the frontend can always render a number
    const ndvi7dChange =
      ndvi7dAgo !== null ? Math.round((currentNdvi - ndvi7dAgo) * 1000) / 1000 : 0;
    const ndvi30dChange =
      ndvi30dAgo !== null ? Math.round((currentNdvi - ndvi30dAgo) * 1000) / 1000 : 0;

    // ── 7. Sub-regions (next level down) ─────────────────────────────────
    const subRegions = await this.regionModel
      .find({ parentId: regionId })
      .lean()
      .exec();

    const subRegionData = await Promise.all(
      subRegions.map(async (sub) => {
        // Farmers in this sub-region
        const subFarmerIds = await this.getFarmerUserIdsForRegion(sub as any);
        const subFarmerCount = subFarmerIds.length;

        // Sub-sub-regions (the level below this sub-region)
        // IMPORTANT: must include `level` in projection so farmerMatchForRegion works correctly.
        const subSubRegions = await this.regionModel
          .find({ parentId: sub.regionId }, { name: 1, regionId: 1, level: 1 })
          .lean()
          .exec();

        // For each sub-sub-region, count its own farmers
        const subSubData = await Promise.all(
          subSubRegions.map(async (ssub) => {
            const ssubFarmerIds = await this.getFarmerUserIdsForRegion(ssub as any);
            return {
              name: ssub.name,
              regionId: ssub.regionId,
              farmerCount: ssubFarmerIds.length,
            };
          }),
        );

        // Cultivated ha & insured in this sub-region
        const [subCultivatedHa, subInsuredFarmers] = await Promise.all([
          this.getTotalCultivatedHa(subFarmerIds),
          this.getUniqueInsuredFarmersCount(subFarmerIds),
        ]);

        // Latest NDVI for this sub-region
        const subLatestAgg = await this.dailyAggModel
          .findOne({ regionId: sub.regionId })
          .sort({ date: -1 })
          .lean()
          .exec();

        return {
          regionId: sub.regionId,
          name: sub.name,
          level: sub.level,
          farmerCount: subFarmerCount,
          insuredCount: subInsuredFarmers,
          insuredPercent:
            subFarmerCount > 0 ? Math.round((subInsuredFarmers / subFarmerCount) * 100) : 0,
          cultivatedHa: subCultivatedHa,
          ndvi: subLatestAgg?.metrics?.ndvi || 0.65,
          // The sub-sub-regions (only names + their farmer count)
          subRegions: subSubData,
          subRegionCount: subSubData.length,
        };
      }),
    );

    // Sort sub-regions by farmer count desc (leaderboard ordering)
    subRegionData.sort((a, b) => b.farmerCount - a.farmerCount);

    // ── 8. Risk level (simple heuristic based on NDVI + active claims) ────
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const claimsRatio = totalFarmers > 0 ? activeClaims / totalFarmers : 0;
    if (currentNdvi < 0.3 || claimsRatio > 0.2) riskLevel = 'HIGH';
    else if (currentNdvi < 0.5 || claimsRatio > 0.1) riskLevel = 'MEDIUM';

    // ── 9. Compose response ───────────────────────────────────────────────
    return {
      region: {
        regionId: region.regionId,
        name: region.name,
        level: region.level,
        parentId: region.parentId,
      },
      snapshot: {
        totalFarmers,
        activePolicies,
        insurancePercent,
        activeClaims,
        totalCultivatedHa: Math.round(totalCultivatedHa * 100) / 100,
        riskLevel,
        ndvi: {
          current: currentNdvi,
          change7d: ndvi7dChange,
          change30d: ndvi30dChange,
        },
        dominantCrop: dominantCrop
          ? { crop: dominantCrop.crop, totalHa: dominantCrop.totalHa }
          : null,
        leastCrop: leastCrop && leastCrop !== dominantCrop
          ? { crop: leastCrop.crop, totalHa: leastCrop.totalHa }
          : null,
      },
      cropBreakdown,
      farmers,
      subRegions: subRegionData,
    };
  }

  // ─── Legacy / other endpoints (kept intact) ──────────────────────────────

  async getRegionAnalytics(regionId: string) {
    const latestAgg = await this.dailyAggModel
      .findOne({ regionId })
      .sort({ date: -1 })
      .exec();

    if (!latestAgg) {
      return { ndvi: 0, insurance: 0, yield: 0, claims: 0, subsidy: 0, cultivated: 0 };
    }

    return latestAgg.metrics;
  }

  async getSubRegionsLeaderboard(regionId: string) {
    const children = await this.regionModel.find({ parentId: regionId }).exec();
    const childIds = children.map((c) => c.regionId);

    const latestAggs = await this.dailyAggModel.aggregate([
      { $match: { regionId: { $in: childIds } } },
      { $sort: { date: -1 } },
      { $group: { _id: '$regionId', metrics: { $first: '$metrics' }, season: { $first: '$season' } } },
    ]);

    const metricsMap = new Map(latestAggs.map((agg) => [agg._id, agg.metrics]));

    return children.map((child) => ({
      id: child.regionId,
      name: child.name,
      metrics: metricsMap.get(child.regionId) || {
        ndvi: 0, insurance: 0, yield: 0, claims: 0, subsidy: 0, cultivated: 0,
      },
    }));
  }

  async getRegionTrends(regionId: string) {
    const trends = await this.dailyAggModel
      .find({ regionId })
      .sort({ date: -1 })
      .limit(12)
      .exec();

    return trends.reverse().map((t) => ({ date: t.date, ndvi: t.metrics.ndvi }));
  }

  async getClaimsEpicenters(regionId: string) {
    return [
      { cause: 'Drought', count: 45, severity: 'High' },
      { cause: 'Pest', count: 12, severity: 'Medium' },
      { cause: 'Flood', count: 3, severity: 'Low' },
    ];
  }

  async getRegionFarmers(regionId: string, page: number = 1, limit: number = 10) {
    const region = await this.regionModel.findOne({ regionId }).exec();
    if (!region) throw new NotFoundException();

    const query = farmerMatchForRegion(region);

    const [total, farmers] = await Promise.all([
      this.farmerProfileModel.countDocuments(query),
      this.farmerProfileModel
        .find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'firstName lastName phoneNumber')
        .exec(),
    ]);

    return {
      data: farmers.map((f) => ({
        id: (f as any)._id,
        name: (f as any).userId
          ? `${(f as any).userId.firstName} ${(f as any).userId.lastName}`
          : 'Unknown',
        phone: (f as any).userId ? (f as any).userId.phoneNumber : '',
      })),
      total,
      page,
      limit,
    };
  }
}
