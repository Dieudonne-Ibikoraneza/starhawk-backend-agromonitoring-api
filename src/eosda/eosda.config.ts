import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EosdaConfig implements OnModuleInit {
  private readonly logger = new Logger(EosdaConfig.name);
  private readonly apiUrl: string;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    // EOSDA API Connect base URL
    // Read from ConfigService first, then process.env, then use default
    this.apiUrl =
      this.configService.get<string>('EOSDA_API_URL') ||
      process.env.EOSDA_API_URL ||
      'https://api-connect.eos.com'; // Correct default URL

    // Read API key from ConfigService
    // Try multiple ways to ensure we get it
    this.apiKey =
      this.configService.get<string>('EOSDA_API_KEY') ||
      process.env.EOSDA_API_KEY ||
      '';

    // Debug logging to see what we're getting
    this.logger.debug(
      `EOSDA Config initialized: URL=${this.apiUrl}, API Key=${this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NOT SET'}`,
    );

    if (!this.apiKey || this.apiKey.trim() === '') {
      this.logger.warn(
        'EOSDA_API_KEY is empty. Checking environment variables...',
      );
      this.logger.debug(
        `ConfigService.get('EOSDA_API_KEY'): ${this.configService.get<string>('EOSDA_API_KEY') || 'NOT_FOUND'}`,
      );
      this.logger.debug(
        `process.env.EOSDA_API_KEY: ${process.env.EOSDA_API_KEY || 'NOT_SET'}`,
      );
    }

    // Validate URL
    if (!this.apiUrl || this.apiUrl === 'https://api.eos.com') {
      this.logger.warn(
        `EOSDA_API_URL is set to incorrect value: ${this.apiUrl}. It should be: https://api-connect.eos.com`,
      );
    }
  }

  onModuleInit() {
    // Validate configuration on module initialization
    if (!this.apiKey || this.apiKey.trim() === '') {
      this.logger.error(
        'EOSDA_API_KEY is not set! EOSDA integration will not work.',
      );
      this.logger.error(
        'Please check your .env file and ensure EOSDA_API_KEY is set correctly.',
      );
      this.logger.warn(
        'Get your API key from: https://api-connect.eos.com/user/dashboard',
      );
    } else {
      this.logger.log(
        `EOSDA API configured successfully: URL=${this.apiUrl}, API Key=${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`,
      );
    }

    // Final URL validation
    if (this.apiUrl !== 'https://api-connect.eos.com') {
      this.logger.error(
        `EOSDA_API_URL is incorrect! Current: ${this.apiUrl}, Expected: https://api-connect.eos.com`,
      );
      this.logger.warn(
        'Please update EOSDA_API_URL in your .env file to: https://api-connect.eos.com',
      );
    }
  }

  getApiUrl(): string {
    return this.apiUrl;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  /**
   * Get headers for EOSDA API requests
   * EOSDA API uses x-api-key header for authentication
   */
  getHeaders(): Record<string, string> {
    if (!this.apiKey || this.apiKey.trim() === '') {
      this.logger.error(
        'EOSDA API key is not configured. Requests will fail.',
      );
    }
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get query parameters for EOSDA API requests
   * Note: We're using headers only, not query params
   */
  getQueryParams(): Record<string, string> {
    return {};
  }
}
