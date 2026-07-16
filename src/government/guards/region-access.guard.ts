import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GovernmentService } from '../government.service';

@Injectable()
export class RegionAccessGuard implements CanActivate {
  constructor(private readonly governmentService: GovernmentService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requestedRegionId = request.params.regionId;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Admin has full access
    if (user.role === 'ADMIN') {
      return true;
    }

    if (user.role !== 'GOVERNMENT') {
      throw new ForbiddenException('Only government officials can access this data');
    }

    if (!requestedRegionId) {
      throw new ForbiddenException('Region ID is required');
    }

    const hasAccess = await this.governmentService.verifyRegionAccess(user.userId, requestedRegionId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to access this region');
    }

    return true;
  }
}
