import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  context?: Record<string, any>;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly isEmailEnabled: boolean;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    // Check if email configuration is provided
    const mailHost = this.configService.get<string>('MAIL_HOST');
    const mailUser = this.configService.get<string>('MAIL_USER');
    const mailPassword = this.configService.get<string>('MAIL_PASSWORD');

    this.isEmailEnabled = !!(mailHost && mailUser && mailPassword);

    if (!this.isEmailEnabled) {
      this.logger.warn(
        'Email service is disabled - MAIL_HOST, MAIL_USER, or MAIL_PASSWORD not configured',
      );
    }
  }

  async onModuleInit() {
    // Note: MailerService doesn't expose verify() directly
    // Connection will be verified on first email send
    if (this.isEmailEnabled) {
      this.logger.log('Email service initialized and ready');
    }
  }

  /**
   * Send email with retry logic
   */
  private async sendEmailWithRetry(
    options: EmailOptions,
    retries = 3,
  ): Promise<void> {
    if (!this.isEmailEnabled) {
      this.logger.warn(
        `Email disabled - Skipping email to ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`,
      );
      return;
    }

    // Get email configuration for logging
    const mailHost = this.configService.get<string>('MAIL_HOST');
    const mailPort = this.configService.get<number>('MAIL_PORT', 587);
    const mailSecure = this.configService.get<string>('MAIL_SECURE', 'false');
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    this.logger.log(`Attempting to send email to: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    this.logger.log(`SMTP Config: ${mailHost}:${mailPort} (secure: ${mailSecure}, production: ${isProduction})`);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      let startTime: number | null = null;
      try {
        startTime = Date.now();
        
        await this.mailerService.sendMail({
          to: options.to,
          subject: options.subject,
          template: options.template,
          context: options.context,
          html: options.html,
          text: options.text,
          cc: options.cc,
          bcc: options.bcc,
          attachments: options.attachments,
        });

        const duration = Date.now() - (startTime || 0);
        this.logger.log(
          `Email sent successfully to ${Array.isArray(options.to) ? options.to.join(', ') : options.to} (took ${duration}ms)`,
        );
        return;
      } catch (error: any) {
        lastError = error;
        const duration = startTime ? Date.now() - startTime : 0;

        // Comprehensive error logging
        this.logger.error(`=== Email Send Failure Details (Attempt ${attempt}/${retries}) ===`);
        this.logger.error(`Error Message: ${error.message || 'Unknown error'}`);
        this.logger.error(`Error Type: ${error.name || error.constructor?.name || 'Unknown'}`);
        this.logger.error(`Error Code: ${error.code || 'N/A'}`);
        this.logger.error(`Duration before failure: ${duration}ms`);
        
        // Nodemailer specific error properties
        const nodemailerError = error as any;
        
        if (nodemailerError.code) {
          this.logger.error(`Nodemailer Error Code: ${nodemailerError.code}`);
          
          // Map common error codes to explanations
          const errorCodeMap: Record<string, string> = {
            ETIMEDOUT: 'Connection timeout - server did not respond in time',
            ECONNREFUSED: 'Connection refused - server rejected the connection',
            ENOTFOUND: 'DNS resolution failed - could not resolve hostname',
            EHOSTUNREACH: 'Host unreachable - network routing issue',
            ECONNRESET: 'Connection reset by peer - server closed connection',
            EAI_AGAIN: 'DNS lookup failed - temporary DNS resolution failure',
            EPIPE: 'Broken pipe - connection was closed unexpectedly',
            ESOCKET: 'Socket error - network communication problem',
            EAUTH: 'Authentication failed - invalid credentials',
          };
          
          const codeExplanation = errorCodeMap[nodemailerError.code] || 'Unknown error code';
          this.logger.error(`Error Explanation: ${codeExplanation}`);
        }

        if (nodemailerError.response) {
          this.logger.error(`SMTP Response: ${nodemailerError.response}`);
        }

        if (nodemailerError.responseCode) {
          this.logger.error(`SMTP Response Code: ${nodemailerError.responseCode}`);
        }

        if (nodemailerError.command) {
          this.logger.error(`Failed SMTP Command: ${nodemailerError.command}`);
        }

        if (nodemailerError.errno) {
          this.logger.error(`System Error Number: ${nodemailerError.errno}`);
        }

        if (nodemailerError.syscall) {
          this.logger.error(`System Call: ${nodemailerError.syscall}`);
        }

        if (nodemailerError.address) {
          this.logger.error(`Failed Address: ${nodemailerError.address}`);
        }

        if (nodemailerError.port) {
          this.logger.error(`Failed Port: ${nodemailerError.port}`);
        }

        // Network/TLS specific errors
        if (nodemailerError.err) {
          this.logger.error(`Underlying Error: ${JSON.stringify(nodemailerError.err)}`);
        }

        // Stack trace for debugging
        if (error.stack) {
          this.logger.error(`Stack Trace:\n${error.stack}`);
        }

        // Environment and configuration info
        this.logger.error(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
        this.logger.error(`SMTP Host: ${mailHost}`);
        this.logger.error(`SMTP Port: ${mailPort}`);
        this.logger.error(`SMTP Secure: ${mailSecure}`);
        this.logger.error(`Retry Attempt: ${attempt}/${retries}`);

        this.logger.error('==================================================');

        if (attempt < retries) {
          // Exponential backoff: wait 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          this.logger.warn(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed - final comprehensive error log
    this.logger.error('=== FINAL EMAIL SEND FAILURE SUMMARY ===');
    this.logger.error(`Failed to send email after ${retries} attempts`);
    this.logger.error(`Recipient: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    this.logger.error(`Subject: ${options.subject}`);
    this.logger.error(`Last Error: ${lastError?.message || 'Unknown'}`);
    this.logger.error(`Error Code: ${(lastError as any)?.code || 'N/A'}`);
    this.logger.error(`SMTP Configuration: ${mailHost}:${mailPort}`);
    this.logger.error(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    
    const nodemailerError = lastError as any;
    if (nodemailerError?.code) {
      this.logger.error(`Final Error Code: ${nodemailerError.code}`);
    }
    if (nodemailerError?.response) {
      this.logger.error(`Final SMTP Response: ${nodemailerError.response}`);
    }
    if (lastError?.stack) {
      this.logger.error(`Final Stack Trace:\n${lastError.stack}`);
    }
    this.logger.error('==========================================');

    // Don't throw - email failures shouldn't block business logic
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(
    email: string,
    firstName: string,
    phoneNumber: string,
    password: string,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'Welcome to Starhawk Platform',
      template: './welcome',
      context: {
        firstName,
        phoneNumber,
        password,
      },
    });

    // Log credentials in development for testing
    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      this.logger.warn(
        `User credentials - Email: ${email}, Phone: ${phoneNumber}, Password: ${password}`,
      );
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetToken: string,
    resetUrl: string,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'Reset Your Starhawk Platform Password',
      template: './password-reset',
      context: {
        firstName,
        resetToken,
        resetUrl,
        expirationHours: 24,
      },
    });
  }

  /**
   * Send assessment assignment notification
   */
  async sendAssessmentAssignmentEmail(
    email: string,
    firstName: string,
    farmName: string,
    assessmentId: string,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'New Assessment Assignment - Starhawk Platform',
      template: './assessment-assignment',
      context: {
        firstName,
        farmName,
        assessmentId,
      },
    });
  }

  /**
   * Send assessment submission notification
   */
  async sendAssessmentSubmissionEmail(
    email: string,
    firstName: string,
    farmName: string,
    riskScore: number,
    assessmentId: string,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'Assessment Submitted - Starhawk Platform',
      template: './assessment-submission',
      context: {
        firstName,
        farmName,
        riskScore,
        assessmentId,
      },
    });
  }

  /**
   * Send policy issuance notification
   */
  async sendPolicyIssuanceEmail(
    email: string,
    firstName: string,
    policyNumber: string,
    premiumAmount: number,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'Policy Issued - Starhawk Platform',
      template: './policy-issuance',
      context: {
        firstName,
        policyNumber,
        premiumAmount,
        startDate,
        endDate,
      },
    });
  }

  /**
   * Send farm registration notification to admin
   */
  async sendFarmRegistrationNotification(
    email: string,
    adminFirstName: string,
    farmerName: string,
    farmerEmail: string,
    farmerPhone: string,
    cropType: string,
    sowingDate: string,
    farmId: string,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'New Farm Registration - Starhawk Platform',
      template: './farm-registration',
      context: {
        adminFirstName,
        farmerName,
        farmerEmail,
        farmerPhone,
        cropType,
        sowingDate,
        farmId,
      },
    });
  }

  /**
   * Send report ready notification to insurer
   */
  async sendReportReadyNotification(
    email: string,
    firstName: string,
    farmName: string,
    assessmentId: string,
    riskScore: number,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'Assessment Report Ready for Review - Starhawk Platform',
      template: './report-ready',
      context: {
        firstName,
        farmName,
        assessmentId,
        riskScore,
      },
    });
  }

  /**
   * Send assessment approval notification
   */
  async sendAssessmentApprovalEmail(
    email: string,
    firstName: string,
    farmName: string,
    assessmentId: string,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'Assessment Approved - Starhawk Platform',
      template: './assessment-approval',
      context: {
        firstName,
        farmName,
        assessmentId,
      },
    });
  }

  /**
   * Send assessment rejection notification
   */
  async sendAssessmentRejectionEmail(
    email: string,
    firstName: string,
    farmName: string,
    assessmentId: string,
    rejectionReason: string,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'Assessment Rejected - Starhawk Platform',
      template: './assessment-rejection',
      context: {
        firstName,
        farmName,
        assessmentId,
        rejectionReason,
      },
    });
  }

  /**
   * Send crop monitoring report notification to insurer
   */
  async sendMonitoringReportEmail(
    email: string,
    firstName: string,
    farmName: string,
    monitoringId: string,
    monitoringNumber: number,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: `Crop Monitoring Report #${monitoringNumber} Ready - Starhawk Platform`,
      template: './monitoring-report',
      context: {
        firstName,
        farmName,
        monitoringId,
        monitoringNumber,
      },
    });
  }

  /**
   * Send claim filed notification
   */
  async sendClaimFiledEmail(
    email: string,
    firstName: string,
    claimId: string,
    eventType: string,
    eventDate: string,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'Claim Filed - Starhawk Platform',
      template: './claim-filed',
      context: {
        firstName,
        claimId,
        eventType,
        eventDate,
      },
    });
  }

  /**
   * Send claim approval notification
   */
  async sendClaimApprovalEmail(
    email: string,
    firstName: string,
    claimId: string,
    payoutAmount: number,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'Claim Approved - Starhawk Platform',
      template: './claim-approval',
      context: {
        firstName,
        claimId,
        payoutAmount,
      },
    });
  }

  /**
   * Send claim rejection notification
   */
  async sendClaimRejectionEmail(
    email: string,
    firstName: string,
    claimId: string,
    rejectionReason: string,
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to: email,
      subject: 'Claim Decision - Starhawk Platform',
      template: './claim-rejection',
      context: {
        firstName,
        claimId,
        rejectionReason,
      },
    });
  }

  /**
   * Send custom email with template
   */
  async sendTemplateEmail(
    to: string | string[],
    subject: string,
    template: string,
    context: Record<string, any>,
    options?: {
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: Array<{
        filename: string;
        content?: Buffer | string;
        path?: string;
        contentType?: string;
      }>;
    },
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to,
      subject,
      template: `./${template}`,
      context,
      cc: options?.cc,
      bcc: options?.bcc,
      attachments: options?.attachments,
    });
  }

  /**
   * Send custom email with HTML content
   */
  async sendHtmlEmail(
    to: string | string[],
    subject: string,
    html: string,
    text?: string,
    options?: {
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: Array<{
        filename: string;
        content?: Buffer | string;
        path?: string;
        contentType?: string;
      }>;
    },
  ): Promise<void> {
    await this.sendEmailWithRetry({
      to,
      subject,
      html,
      text,
      cc: options?.cc,
      bcc: options?.bcc,
      attachments: options?.attachments,
    });
  }
}

