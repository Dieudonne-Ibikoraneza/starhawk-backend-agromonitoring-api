import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';

export interface DroneAnalysisResponse {
  success: boolean;
  extractedData?: any;
  error?: string;
}

@Injectable()
export class DroneAnalysisService {
  private readonly logger = new Logger(DroneAnalysisService.name);
  private readonly serviceUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.serviceUrl =
      this.configService.get<string>('DRONE_ANALYSIS_SERVICE_URL') ||
      'http://localhost:8080';
    this.timeout =
      this.configService.get<number>('DRONE_ANALYSIS_SERVICE_TIMEOUT') ||
      30000;

    this.logger.log(
      `Drone Analysis Service configured: ${this.serviceUrl} (timeout: ${this.timeout}ms)`,
    );
  }

  /**
   * Extract drone data from PDF using Python microservice
   * @param pdfPath - Absolute path to the PDF file
   * @returns Extracted data from the PDF
   */
  async extractDroneData(pdfPath: string): Promise<DroneAnalysisResponse> {
    try {
      this.logger.log(`Extracting drone data from PDF: ${pdfPath}`);
      this.logger.log(`Calling Python service at: ${this.serviceUrl}/extract-drone-data`);

      // Read file and encode as base64
      let pdfContent: string;
      try {
        const fileBuffer = fs.readFileSync(pdfPath);
        pdfContent = fileBuffer.toString('base64');
        this.logger.debug(`Read PDF file: ${fileBuffer.length} bytes, encoded to base64: ${pdfContent.length} characters`);
      } catch (fileError: any) {
        this.logger.error(`Failed to read PDF file: ${fileError.message}`);
        return {
          success: false,
          error: `Failed to read PDF file: ${fileError.message}`,
        };
      }

      // Send base64 content to Python service
      const requestBody = { pdfContent };
      this.logger.debug(`Request body size: ${pdfContent.length} characters (base64)`);

      const response = await firstValueFrom(
        this.httpService.post<DroneAnalysisResponse>(
          `${this.serviceUrl}/extract-drone-data`,
          requestBody,
          {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      this.logger.debug(`Python service response status: ${response.status}`);
      this.logger.debug(`Python service response data: ${JSON.stringify(response.data)}`);

      if (response.data.success && response.data.extractedData) {
        this.logger.log('Successfully extracted drone data from PDF');
        return response.data;
      } else {
        this.logger.warn('Python service returned unsuccessful response');
        return {
          success: false,
          error: response.data.error || 'Failed to extract data',
        };
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to extract drone data: ${error.message}`,
        error.stack,
      );

      // Enhanced error logging
      this.logger.error(`Error code: ${error.code}`);
      this.logger.error(`Error response: ${JSON.stringify(error.response?.data)}`);
      this.logger.error(`Error config URL: ${error.config?.url}`);
      this.logger.error(`Error config method: ${error.config?.method}`);
      this.logger.error(`Error config data: ${JSON.stringify(error.config?.data)}`);

      // Handle different error types
      if (error.code === 'ECONNREFUSED') {
        this.logger.error(
          `Connection refused to ${this.serviceUrl}. Is the Python service running on port 8080?`,
        );
        return {
          success: false,
          error: `Drone analysis service is not available at ${this.serviceUrl}. Please ensure the service is running.`,
        };
      }

      if (error.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: 'Request to drone analysis service timed out',
        };
      }

      if (error.response) {
        this.logger.error(
          `Python service returned error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
        );
        return {
          success: false,
          error: error.response.data?.error || error.response.data?.detail || 'Python service returned an error',
        };
      }

      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }
}

