import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import {
  TestEmailDto,
  TestWelcomeEmailDto,
  TestPasswordResetEmailDto,
  TestAssessmentAssignmentEmailDto,
  TestAssessmentSubmissionEmailDto,
  TestPolicyIssuanceEmailDto,
  TestFarmRegistrationNotificationDto,
  TestReportReadyNotificationDto,
  TestAssessmentApprovalEmailDto,
  TestAssessmentRejectionEmailDto,
  TestMonitoringReportEmailDto,
  TestClaimFiledEmailDto,
  TestClaimApprovalEmailDto,
  TestClaimRejectionEmailDto,
} from './dto/test-email.dto';

@ApiTags('Email Testing')
@ApiBearerAuth()
@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test/welcome')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test welcome email template' })
  @ApiResponse({ status: 200, description: 'Welcome email sent successfully' })
  async testWelcomeEmail(@Body() dto: TestWelcomeEmailDto) {
    await this.emailService.sendWelcomeEmail(
      dto.email,
      dto.firstName,
      dto.phoneNumber,
      dto.password,
    );
    return {
      template: 'welcome',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test password reset email template' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent successfully',
  })
  async testPasswordResetEmail(@Body() dto: TestPasswordResetEmailDto) {
    await this.emailService.sendPasswordResetEmail(
      dto.email,
      dto.firstName,
      dto.resetToken,
      dto.resetUrl,
    );
    return {
      template: 'password-reset',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/assessment-assignment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test assessment assignment email template' })
  @ApiResponse({
    status: 200,
    description: 'Assessment assignment email sent successfully',
  })
  async testAssessmentAssignmentEmail(
    @Body() dto: TestAssessmentAssignmentEmailDto,
  ) {
    await this.emailService.sendAssessmentAssignmentEmail(
      dto.email,
      dto.firstName,
      dto.farmName,
      dto.assessmentId,
    );
    return {
      template: 'assessment-assignment',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/assessment-submission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test assessment submission email template' })
  @ApiResponse({
    status: 200,
    description: 'Assessment submission email sent successfully',
  })
  async testAssessmentSubmissionEmail(
    @Body() dto: TestAssessmentSubmissionEmailDto,
  ) {
    await this.emailService.sendAssessmentSubmissionEmail(
      dto.email,
      dto.firstName,
      dto.farmName,
      dto.riskScore,
      dto.assessmentId,
    );
    return {
      template: 'assessment-submission',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/policy-issuance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test policy issuance email template' })
  @ApiResponse({
    status: 200,
    description: 'Policy issuance email sent successfully',
  })
  async testPolicyIssuanceEmail(@Body() dto: TestPolicyIssuanceEmailDto) {
    await this.emailService.sendPolicyIssuanceEmail(
      dto.email,
      dto.firstName,
      dto.policyNumber,
      dto.premiumAmount,
      dto.startDate,
      dto.endDate,
    );
    return {
      template: 'policy-issuance',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/farm-registration')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test farm registration notification email template' })
  @ApiResponse({
    status: 200,
    description: 'Farm registration notification email sent successfully',
  })
  async testFarmRegistrationNotification(
    @Body() dto: TestFarmRegistrationNotificationDto,
  ) {
    await this.emailService.sendFarmRegistrationNotification(
      dto.email,
      dto.adminFirstName,
      dto.farmerName,
      dto.farmerEmail,
      dto.farmerPhone,
      dto.cropType,
      dto.sowingDate,
      dto.farmId,
    );
    return {
      template: 'farm-registration',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/report-ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test report ready notification email template' })
  @ApiResponse({
    status: 200,
    description: 'Report ready notification email sent successfully',
  })
  async testReportReadyNotification(@Body() dto: TestReportReadyNotificationDto) {
    await this.emailService.sendReportReadyNotification(
      dto.email,
      dto.firstName,
      dto.farmName,
      dto.assessmentId,
      dto.riskScore,
    );
    return {
      template: 'report-ready',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/assessment-approval')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test assessment approval email template' })
  @ApiResponse({
    status: 200,
    description: 'Assessment approval email sent successfully',
  })
  async testAssessmentApprovalEmail(
    @Body() dto: TestAssessmentApprovalEmailDto,
  ) {
    await this.emailService.sendAssessmentApprovalEmail(
      dto.email,
      dto.firstName,
      dto.farmName,
      dto.assessmentId,
    );
    return {
      template: 'assessment-approval',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/assessment-rejection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test assessment rejection email template' })
  @ApiResponse({
    status: 200,
    description: 'Assessment rejection email sent successfully',
  })
  async testAssessmentRejectionEmail(
    @Body() dto: TestAssessmentRejectionEmailDto,
  ) {
    await this.emailService.sendAssessmentRejectionEmail(
      dto.email,
      dto.firstName,
      dto.farmName,
      dto.assessmentId,
      dto.rejectionReason,
    );
    return {
      template: 'assessment-rejection',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/monitoring-report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test monitoring report email template' })
  @ApiResponse({
    status: 200,
    description: 'Monitoring report email sent successfully',
  })
  async testMonitoringReportEmail(@Body() dto: TestMonitoringReportEmailDto) {
    await this.emailService.sendMonitoringReportEmail(
      dto.email,
      dto.firstName,
      dto.farmName,
      dto.monitoringId,
      dto.monitoringNumber,
    );
    return {
      template: 'monitoring-report',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/claim-filed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test claim filed email template' })
  @ApiResponse({
    status: 200,
    description: 'Claim filed email sent successfully',
  })
  async testClaimFiledEmail(@Body() dto: TestClaimFiledEmailDto) {
    await this.emailService.sendClaimFiledEmail(
      dto.email,
      dto.firstName,
      dto.claimId,
      dto.eventType,
      dto.eventDate,
    );
    return {
      template: 'claim-filed',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/claim-approval')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test claim approval email template' })
  @ApiResponse({
    status: 200,
    description: 'Claim approval email sent successfully',
  })
  async testClaimApprovalEmail(@Body() dto: TestClaimApprovalEmailDto) {
    await this.emailService.sendClaimApprovalEmail(
      dto.email,
      dto.firstName,
      dto.claimId,
      dto.payoutAmount,
    );
    return {
      template: 'claim-approval',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test/claim-rejection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test claim rejection email template' })
  @ApiResponse({
    status: 200,
    description: 'Claim rejection email sent successfully',
  })
  async testClaimRejectionEmail(@Body() dto: TestClaimRejectionEmailDto) {
    await this.emailService.sendClaimRejectionEmail(
      dto.email,
      dto.firstName,
      dto.claimId,
      dto.rejectionReason,
    );
    return {
      template: 'claim-rejection',
      recipient: dto.email,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test all email templates',
    description:
      'Sends a test email for each template type. Requires a base email address.',
  })
  @ApiResponse({
    status: 200,
    description: 'All test emails sent successfully',
  })
  async testAllEmails(@Body() dto: TestEmailDto) {
    const results = [];
    const testData = {
      firstName: 'Test',
      phoneNumber: '+250788123456',
      password: 'TestPassword123!',
      resetToken: 'test-reset-token-12345',
      resetUrl: 'https://starhawk.com/reset-password?token=test-reset-token-12345',
      farmName: 'Test Farm',
      assessmentId: '507f1f77bcf86cd799439011',
      riskScore: 75.5,
      policyNumber: 'POL-2025-001',
      premiumAmount: 50000,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      adminFirstName: 'Admin',
      farmerName: 'Test Farmer',
      farmerEmail: 'farmer@test.com',
      farmerPhone: '+250788123456',
      cropType: 'MAIZE',
      sowingDate: '2025-04-15',
      farmId: '507f1f77bcf86cd799439011',
      monitoringId: '507f1f77bcf86cd799439011',
      monitoringNumber: 1,
      claimId: '507f1f77bcf86cd799439011',
      eventType: 'DROUGHT',
      eventDate: '2025-01-15',
      payoutAmount: 100000,
      rejectionReason: 'Test rejection reason',
    };

    const templates = [
      {
        name: 'welcome',
        send: () =>
          this.emailService.sendWelcomeEmail(
            dto.email,
            testData.firstName,
            testData.phoneNumber,
            testData.password,
          ),
      },
      {
        name: 'password-reset',
        send: () =>
          this.emailService.sendPasswordResetEmail(
            dto.email,
            testData.firstName,
            testData.resetToken,
            testData.resetUrl,
          ),
      },
      {
        name: 'assessment-assignment',
        send: () =>
          this.emailService.sendAssessmentAssignmentEmail(
            dto.email,
            testData.firstName,
            testData.farmName,
            testData.assessmentId,
          ),
      },
      {
        name: 'assessment-submission',
        send: () =>
          this.emailService.sendAssessmentSubmissionEmail(
            dto.email,
            testData.firstName,
            testData.farmName,
            testData.riskScore,
            testData.assessmentId,
          ),
      },
      {
        name: 'policy-issuance',
        send: () =>
          this.emailService.sendPolicyIssuanceEmail(
            dto.email,
            testData.firstName,
            testData.policyNumber,
            testData.premiumAmount,
            testData.startDate,
            testData.endDate,
          ),
      },
      {
        name: 'farm-registration',
        send: () =>
          this.emailService.sendFarmRegistrationNotification(
            dto.email,
            testData.adminFirstName,
            testData.farmerName,
            testData.farmerEmail,
            testData.farmerPhone,
            testData.cropType,
            testData.sowingDate,
            testData.farmId,
          ),
      },
      {
        name: 'report-ready',
        send: () =>
          this.emailService.sendReportReadyNotification(
            dto.email,
            testData.firstName,
            testData.farmName,
            testData.assessmentId,
            testData.riskScore,
          ),
      },
      {
        name: 'assessment-approval',
        send: () =>
          this.emailService.sendAssessmentApprovalEmail(
            dto.email,
            testData.firstName,
            testData.farmName,
            testData.assessmentId,
          ),
      },
      {
        name: 'assessment-rejection',
        send: () =>
          this.emailService.sendAssessmentRejectionEmail(
            dto.email,
            testData.firstName,
            testData.farmName,
            testData.assessmentId,
            testData.rejectionReason,
          ),
      },
      {
        name: 'monitoring-report',
        send: () =>
          this.emailService.sendMonitoringReportEmail(
            dto.email,
            testData.firstName,
            testData.farmName,
            testData.monitoringId,
            testData.monitoringNumber,
          ),
      },
      {
        name: 'claim-filed',
        send: () =>
          this.emailService.sendClaimFiledEmail(
            dto.email,
            testData.firstName,
            testData.claimId,
            testData.eventType,
            testData.eventDate,
          ),
      },
      {
        name: 'claim-approval',
        send: () =>
          this.emailService.sendClaimApprovalEmail(
            dto.email,
            testData.firstName,
            testData.claimId,
            testData.payoutAmount,
          ),
      },
      {
        name: 'claim-rejection',
        send: () =>
          this.emailService.sendClaimRejectionEmail(
            dto.email,
            testData.firstName,
            testData.claimId,
            testData.rejectionReason,
          ),
      },
    ];

    for (const template of templates) {
      try {
        await template.send();
        results.push({
          template: template.name,
          recipient: dto.email,
          status: 'sent',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        results.push({
          template: template.name,
          recipient: dto.email,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return {
      summary: {
        total: templates.length,
        sent: results.filter((r) => r.status === 'sent').length,
        failed: results.filter((r) => r.status === 'failed').length,
      },
      results,
    };
  }
}

