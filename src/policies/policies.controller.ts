import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PoliciesService } from './policies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../users/enums/role.enum';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UuidValidationPipe } from '../common/pipes/uuid-validation.pipe';

@ApiTags('Policies')
@ApiBearerAuth()
@Controller('policies')
@UseGuards(JwtAuthGuard)
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.INSURER)
  @ApiOperation({ summary: 'Issue policy (Insurer only)' })
  @ApiResponse({ status: 201 })
  async issuePolicy(
    @CurrentUser() user: any,
    @Body() createDto: CreatePolicyDto,
  ) {
    return this.policiesService.issuePolicy(user.userId, createDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get policy by ID' })
  @ApiResponse({ status: 200 })
  async getPolicy(@Param('id', UuidValidationPipe) id: string) {
    return this.policiesService.getPolicy(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get policies (own policies based on role)' })
  @ApiResponse({ status: 200 })
  async getPolicies(@CurrentUser() user: any) {
    if (user.role === Role.FARMER) {
      return this.policiesService.getFarmerPolicies(user.userId);
    } else if (user.role === Role.INSURER) {
      return this.policiesService.getInsurerPolicies(user.userId);
    } else if (user.role === Role.ASSESSOR) {
      // Assessor needs visibility into policies for assigned farms
      // to be able to start crop monitoring cycles.
      return this.policiesService.getAssessorPolicies(user.userId);
    }
    return [];
  }
}

