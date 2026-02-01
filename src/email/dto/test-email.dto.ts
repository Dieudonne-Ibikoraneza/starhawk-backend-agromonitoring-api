import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';

export class TestEmailDto {
  @ApiProperty({
    description: 'Recipient email address for testing',
    example: 'test@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

export class TestWelcomeEmailDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: '+250788123456' })
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @ApiProperty({ example: 'TempPassword123!' })
  @IsNotEmpty()
  @IsString()
  password: string;
}

export class TestPasswordResetEmailDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'reset-token-12345' })
  @IsNotEmpty()
  @IsString()
  resetToken: string;

  @ApiProperty({ example: 'https://starhawk.com/reset-password?token=reset-token-12345' })
  @IsNotEmpty()
  @IsString()
  resetUrl: string;
}

export class TestAssessmentAssignmentEmailDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Maize Farm' })
  @IsNotEmpty()
  @IsString()
  farmName: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  assessmentId: string;
}

export class TestAssessmentSubmissionEmailDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Maize Farm' })
  @IsNotEmpty()
  @IsString()
  farmName: string;

  @ApiProperty({ example: 75.5 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  riskScore: number;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  assessmentId: string;
}

export class TestPolicyIssuanceEmailDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'POL-2025-001' })
  @IsNotEmpty()
  @IsString()
  policyNumber: string;

  @ApiProperty({ example: 50000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  premiumAmount: number;

  @ApiProperty({ example: '2025-01-01' })
  @IsNotEmpty()
  @IsString()
  startDate: string;

  @ApiProperty({ example: '2025-12-31' })
  @IsNotEmpty()
  @IsString()
  endDate: string;
}

export class TestFarmRegistrationNotificationDto extends TestEmailDto {
  @ApiProperty({ example: 'Admin' })
  @IsNotEmpty()
  @IsString()
  adminFirstName: string;

  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  farmerName: string;

  @ApiProperty({ example: 'farmer@example.com' })
  @IsNotEmpty()
  @IsEmail()
  farmerEmail: string;

  @ApiProperty({ example: '+250788123456' })
  @IsNotEmpty()
  @IsString()
  farmerPhone: string;

  @ApiProperty({ example: 'MAIZE' })
  @IsNotEmpty()
  @IsString()
  cropType: string;

  @ApiProperty({ example: '2025-04-15' })
  @IsNotEmpty()
  @IsString()
  sowingDate: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  farmId: string;
}

export class TestReportReadyNotificationDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Maize Farm' })
  @IsNotEmpty()
  @IsString()
  farmName: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  assessmentId: string;

  @ApiProperty({ example: 75.5 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  riskScore: number;
}

export class TestAssessmentApprovalEmailDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Maize Farm' })
  @IsNotEmpty()
  @IsString()
  farmName: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  assessmentId: string;
}

export class TestAssessmentRejectionEmailDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Maize Farm' })
  @IsNotEmpty()
  @IsString()
  farmName: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  assessmentId: string;

  @ApiProperty({ example: 'Insufficient documentation provided' })
  @IsNotEmpty()
  @IsString()
  rejectionReason: string;
}

export class TestMonitoringReportEmailDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Maize Farm' })
  @IsNotEmpty()
  @IsString()
  farmName: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  monitoringId: string;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  monitoringNumber: number;
}

export class TestClaimFiledEmailDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  claimId: string;

  @ApiProperty({ example: 'DROUGHT' })
  @IsNotEmpty()
  @IsString()
  eventType: string;

  @ApiProperty({ example: '2025-01-15' })
  @IsNotEmpty()
  @IsString()
  eventDate: string;
}

export class TestClaimApprovalEmailDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  claimId: string;

  @ApiProperty({ example: 100000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  payoutAmount: number;
}

export class TestClaimRejectionEmailDto extends TestEmailDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  claimId: string;

  @ApiProperty({ example: 'Claim does not meet policy coverage requirements' })
  @IsNotEmpty()
  @IsString()
  rejectionReason: string;
}

