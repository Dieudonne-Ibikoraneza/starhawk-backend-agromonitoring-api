import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AgromonitoringConfig implements OnModuleInit {
  private readonly logger = new Logger(AgromonitoringConfig.name);
  private readonly apiUrl: string;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    // AGROmonitoring API base URL
    this.apiUrl =
      this.configService.get<string>('AGROMONITORING_API_URL') ||
      process.env.AGROMONITORING_API_URL ||
      'https://api.agromonitoring.com';

    // Read API key from ConfigService or use provided key
    this.apiKey =
      this.configService.get<string>('AGROMONITORING_API_KEY') ||
      process.env.AGROMONITORING_API_KEY ||
      '2899fb272d1128ba9da8deb6c11a8771'; // AGROmonitoring API key (working one)

    this.logger.debug(
      `AGROmonitoring Config initialized: URL=${this.apiUrl}, API Key=${this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NOT SET'}`,
    );

    if (!this.apiKey || this.apiKey.trim() === '') {
      this.logger.warn('AGROMONITORING_API_KEY is empty. Please check your configuration.');
    }
  }

  onModuleInit() {
    // Validate configuration on module initialization
    if (!this.apiKey || this.apiKey.trim() === '') {
      this.logger.error(
        'AGROMONITORING_API_KEY is not set! AGROmonitoring integration will not work.',
      );
    } else {
      this.logger.log(
        `AGROmonitoring API configured successfully: URL=${this.apiUrl}, API Key=${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`,
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
   * Get headers for AGROmonitoring API requests
   * AGROmonitoring API uses x-api-key header for authentication
   */
  getHeaders(): Record<string, string> {
    if (!this.apiKey || this.apiKey.trim() === '') {
      this.logger.error('AGROmonitoring API key is not configured. Requests will fail.');
    }
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get query parameters for AGROmonitoring API requests
   */
  getQueryParams(): Record<string, string> {
    return {
      appid: this.apiKey,
    };
  }
}
