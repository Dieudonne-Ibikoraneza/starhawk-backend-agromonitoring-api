import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('EmailModule');
        const mailHost = configService.get<string>('MAIL_HOST');
        const mailUser = configService.get<string>('MAIL_USER');
        const mailPassword = configService.get<string>('MAIL_PASSWORD');
        const mailPort = configService.get<number>('MAIL_PORT', 587);
        // Parse MAIL_SECURE as boolean - handle string 'false'/'true' from env
        const mailSecureEnv = configService.get<string>('MAIL_SECURE');
        const mailSecure = mailSecureEnv === undefined 
          ? undefined 
          : mailSecureEnv.toLowerCase() === 'true';
        const mailFrom = configService.get<string>(
          'MAIL_FROM',
          'noreply@starhawk.com',
        );

        // Check if email is enabled
        const isEmailEnabled = !!(mailHost && mailUser && mailPassword);

        if (!isEmailEnabled) {
          // Return a minimal config that won't fail initialization
          return {
            transport: {
              host: 'localhost',
              port: 587,
              secure: false,
              auth: {
                user: 'dummy',
                pass: 'dummy',
              },
            },
            defaults: {
              from: mailFrom,
            },
            template: {
              dir: join(__dirname, 'templates'),
              adapter: new HandlebarsAdapter(),
              options: {
                strict: true,
              },
            },
          };
        }

        // Port 465 uses direct SSL/TLS, port 587 uses STARTTLS
        // If secure is explicitly set, use it; otherwise auto-detect based on port
        const isSecure = mailSecure !== undefined 
          ? mailSecure 
          : mailPort === 465;

        // Detect if running in production
        const isProduction = configService.get<string>('NODE_ENV') === 'production';

        // Log email configuration (without sensitive data)
        if (isEmailEnabled) {
          logger.log(`Email service configured: ${mailHost}:${mailPort} (secure: ${isSecure})`);
          
          // Enhanced logging for production debugging
          if (isProduction) {
            logger.log('=== Production Email Configuration ===');
            logger.log(`Host: ${mailHost}`);
            logger.log(`Port: ${mailPort}`);
            logger.log(`Secure: ${isSecure}`);
            logger.log(`Require TLS: ${mailPort === 587 && !isSecure ? 'true' : 'false'}`);
            logger.log('=======================================');
          }
        } else {
          logger.warn('Email service disabled - missing configuration');
        }

        // Simple transport configuration matching working nest-mailer setup
        const transportConfig: any = {
          host: mailHost,
          port: mailPort,
          secure: isSecure, // true for 465, false for 587
          auth: {
            user: mailUser,
            pass: mailPassword,
          },
          tls: {
            rejectUnauthorized: false, // Set to true in production with proper certificates
          },
          // Connection pool settings
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          // Timeout settings
          connectionTimeout: 10000, // 10 seconds
          greetingTimeout: 5000, // 5 seconds
          socketTimeout: 10000, // 10 seconds
        };

        // For port 587 (STARTTLS), explicitly require TLS upgrade
        // This ensures STARTTLS is used on port 587
        if (mailPort === 587 && !isSecure) {
          transportConfig.requireTLS = true;
        }

        // Enhanced logging for production debugging (after config is finalized)
        if (isProduction && isEmailEnabled) {
          logger.log('=== Final Transport Configuration ===');
          logger.log(`Pool: ${transportConfig.pool}`);
          logger.log(`Max Connections: ${transportConfig.maxConnections}`);
          logger.log(`Max Messages: ${transportConfig.maxMessages}`);
          logger.log(`Connection Timeout: ${transportConfig.connectionTimeout}ms`);
          logger.log(`Greeting Timeout: ${transportConfig.greetingTimeout}ms`);
          logger.log(`Socket Timeout: ${transportConfig.socketTimeout}ms`);
          logger.log(`Require TLS: ${transportConfig.requireTLS || false}`);
          logger.log('=====================================');
        }

        return {
          transport: transportConfig,
          defaults: {
            from: `"Starhawk Platform" <${mailFrom}>`,
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

