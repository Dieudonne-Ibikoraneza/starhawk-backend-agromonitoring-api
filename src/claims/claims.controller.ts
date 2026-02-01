import {
  Controller,
  Get,
  Post,
  Put,
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
import { ClaimsService } from './claims.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../users/enums/role.enum';
import { CreateClaimDto } from './dto/create-claim.dto';
import { UpdateClaimAssessmentDto } from './dto/update-claim-assessment.dto';
import { UuidValidationPipe } from '../common/pipes/uuid-validation.pipe';

@ApiTags('Claims')
@ApiBearerAuth()
@Controller('claims')
@UseGuards(JwtAuthGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.FARMER)
  @ApiOperation({ summary: 'File a claim (Farmer only)' })
  @ApiResponse({ status: 201 })
  async fileClaim(@CurrentUser() user: any, @Body() createDto: CreateClaimDto) {
    return this.claimsService.fileClaim(user.userId, createDto);
  }

  @Put(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(Role.INSURER)
  @ApiOperation({ summary: 'Assign assessor to claim (Insurer only)' })
  @ApiResponse({ status: 200 })
  async assignAssessor(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body('assessorId') assessorId: string,
  ) {
    return this.claimsService.assignAssessor(user.userId, id, assessorId);
  }

  @Put(':id/assessment')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Update claim assessment (Assessor only)' })
  @ApiResponse({ status: 200 })
  async updateAssessment(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body() updateDto: UpdateClaimAssessmentDto,
  ) {
    return this.claimsService.updateClaimAssessment(
      user.userId,
      id,
      updateDto,
    );
  }

  @Post(':id/submit-assessment')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Submit claim assessment (Assessor only)' })
  @ApiResponse({ status: 200 })
  async submitAssessment(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
  ) {
    return this.claimsService.submitClaimAssessment(user.userId, id);
  }

  @Put(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.INSURER)
  @ApiOperation({ summary: 'Approve claim (Insurer only)' })
  @ApiResponse({ status: 200 })
  async approveClaim(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body('payoutAmount') payoutAmount: number,
  ) {
    return this.claimsService.approveClaim(user.userId, id, payoutAmount);
  }

  @Put(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.INSURER)
  @ApiOperation({ summary: 'Reject claim (Insurer only)' })
  @ApiResponse({ status: 200 })
  async rejectClaim(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body('rejectionReason') rejectionReason: string,
  ) {
    return this.claimsService.rejectClaim(user.userId, id, rejectionReason);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get claim by ID' })
  @ApiResponse({ status: 200 })
  async getClaim(@Param('id', UuidValidationPipe) id: string) {
    return this.claimsService.getClaim(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get claims (role-based)' })
  @ApiResponse({ status: 200 })
  async getClaims(@CurrentUser() user: any) {
    if (user.role === Role.FARMER) {
      return this.claimsService.getFarmerClaims(user.userId);
    } else if (user.role === Role.ASSESSOR) {
      return this.claimsService.getAssessorClaims(user.userId);
    } else if (user.role === Role.INSURER) {
      return this.claimsService.getInsurerClaims(user.userId);
    } else if (user.role === Role.ADMIN) {
      return this.claimsService.getAllClaims();
    }
    return [];
  }
}

