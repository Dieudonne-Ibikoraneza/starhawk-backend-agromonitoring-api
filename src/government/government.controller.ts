import { Controller, Get, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RegionAccessGuard } from './guards/region-access.guard';
import { GovernmentService } from './government.service';

@ApiTags('Government Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RegionAccessGuard)
@Controller('government')
export class GovernmentController {
  constructor(private readonly governmentService: GovernmentService) {}

  @Get('analytics/region/:regionId')
  @ApiOperation({ summary: 'Get main dashboard metrics for a region' })
  @ApiParam({ name: 'regionId', description: 'The ID of the region to query' })
  getRegionAnalytics(@Param('regionId') regionId: string) {
    return this.governmentService.getRegionAnalytics(regionId);
  }

  @Get('regions/:regionId/sub-regions')
  @ApiOperation({ summary: 'Get metrics for all child sub-regions (Leaderboard)' })
  @ApiParam({ name: 'regionId', description: 'The ID of the parent region' })
  getSubRegionsLeaderboard(@Param('regionId') regionId: string) {
    return this.governmentService.getSubRegionsLeaderboard(regionId);
  }

  @Get('leaderboard/:regionId')
  @ApiOperation({ summary: 'Comprehensive region leaderboard: snapshot, crops, farmers, sub-regions' })
  @ApiParam({ name: 'regionId', description: 'The ID of the region to analyse' })
  getRegionLeaderboard(@Param('regionId') regionId: string) {
    return this.governmentService.getRegionLeaderboard(regionId);
  }

  @Get('analytics/trends/:regionId')
  @ApiOperation({ summary: 'Get time-series trends (e.g. 12 weeks of NDVI) for a region' })
  @ApiParam({ name: 'regionId', description: 'The ID of the region to query' })
  getRegionTrends(@Param('regionId') regionId: string) {
    return this.governmentService.getRegionTrends(regionId);
  }

  @Get('claims/epicenters/:regionId')
  @ApiOperation({ summary: 'Get top claim causes (Epicenters) for a region' })
  @ApiParam({ name: 'regionId', description: 'The ID of the region to query' })
  getClaimsEpicenters(@Param('regionId') regionId: string) {
    return this.governmentService.getClaimsEpicenters(regionId);
  }

  @Get('farmers/:regionId')
  @ApiOperation({ summary: 'List farmers registered in a specific region' })
  @ApiParam({ name: 'regionId', description: 'The ID of the region to query' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRegionFarmers(
    @Param('regionId') regionId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.governmentService.getRegionFarmers(regionId, page, limit);
  }
}
