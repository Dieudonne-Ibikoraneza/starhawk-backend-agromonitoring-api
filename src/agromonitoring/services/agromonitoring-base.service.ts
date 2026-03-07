import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AgromonitoringConfig } from '../agromonitoring.config';

export interface AsyncTaskResponse {
  request_id?: string;
  task_id?: string;
  status: 'processing' | 'success' | 'failed' | 'completed';
  result?: any;
  error?: string;
  progress?: number;
}

@Injectable()
export class AgromonitoringBaseService {
  protected readonly logger = new Logger(this.constructor.name);
  private readonly MAX_RETRIES = 3;
  private readonly RATE_LIMIT_RETRY_DELAY = 6000; // 6 seconds

  constructor(
    protected readonly httpService: HttpService,
    protected readonly config: AgromonitoringConfig,
  ) {}

  protected async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    useRetry = true,
  ): Promise<T> {
    if (useRetry) {
      return this.makeRequestWithRetry<T>(method, endpoint, data);
    }

    return this.makeRequestInternal<T>(method, endpoint, data);
  }

  /**
   * Internal request method (without retry)
   */
  private async makeRequestInternal<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
  ): Promise<T> {
    const apiKey = this.config.getApiKey();

    // Validate API key is set
    if (!apiKey || apiKey.trim() === '') {
      const errorMsg =
        'AGROmonitoring API key is not configured. Please set AGROMONITORING_API_KEY in your .env file.';
      this.logger.error(errorMsg);
      throw new BadRequestException(errorMsg);
    }

    try {
      // Build URL with query parameters for AGROmonitoring
      const baseUrl = this.config.getApiUrl();
      const url = `${baseUrl}${endpoint}`;
      const headers = this.config.getHeaders();

      // Add API key as query parameter (AGROmonitoring uses this method)
      const urlWithAuth = `${url}${url.includes('?') ? '&' : '?'}appid=${apiKey}`;

      // Log full request details for debugging
      this.logger.debug(`AGROmonitoring API Request:`);
      this.logger.debug(`  Method: ${method}`);
      this.logger.debug(`  URL: ${urlWithAuth}`);
      this.logger.debug(`  Headers: ${JSON.stringify(headers, null, 2)}`);
      if (data) {
        const dataStr = JSON.stringify(data, null, 2);
        this.logger.debug(`  Request Body (full):`);
        this.logger.debug(dataStr.substring(0, 2000));
        if (dataStr.length > 2000) {
          this.logger.debug(`  ... (truncated, total length: ${dataStr.length} chars)`);
        }
      }

      let response;
      switch (method) {
        case 'GET':
          response = await firstValueFrom(this.httpService.get<T>(urlWithAuth, { headers }));
          break;
        case 'POST':
          response = await firstValueFrom(this.httpService.post<T>(urlWithAuth, data, { headers }));
          break;
        case 'PUT':
          response = await firstValueFrom(this.httpService.put<T>(urlWithAuth, data, { headers }));
          break;
        case 'DELETE':
          response = await firstValueFrom(this.httpService.delete<T>(urlWithAuth, { headers }));
          break;
      }

      this.logger.debug(`AGROmonitoring API Response: ${JSON.stringify(response.data, null, 2)}`);

      return response.data;
    } catch (error: any) {
      // Enhanced error logging
      this.logger.error(`AGROmonitoring API Request Failed:`);
      this.logger.error(`  Method: ${method}`);
      this.logger.error(`  Endpoint: ${endpoint}`);
      this.logger.error(`  URL: ${error.config?.url || 'unknown'}`);
      this.logger.error(
        `  API Key configured: ${apiKey ? 'YES' : 'NO'} (${apiKey ? `${apiKey.substring(0, 8)}...` : 'missing'})`,
      );

      // Log request body if available
      if (error.config?.data) {
        try {
          const requestBody =
            typeof error.config.data === 'string'
              ? JSON.parse(error.config.data)
              : error.config.data;
          this.logger.error(
            `  Request Body: ${JSON.stringify(requestBody, null, 2).substring(0, 1000)}`,
          );
        } catch (e) {
          this.logger.error(`  Request Body: ${error.config.data.substring(0, 500)}`);
        }
      }

      if (error.response) {
        this.logger.error(`  Status: ${error.response.status}`);
        this.logger.error(`  Response Data: ${JSON.stringify(error.response.data, null, 2)}`);

        // Try to parse HTML error responses
        if (
          typeof error.response.data === 'string' &&
          error.response.data.includes('<!doctype html>')
        ) {
          this.logger.error(
            '  AGROmonitoring API returned HTML error page (500). This usually means the request format is incorrect.',
          );
          this.logger.error(
            '  Please check: 1) Request body format, 2) Required fields, 3) Geometry format',
          );
        }
      } else {
        this.logger.error(`  Error Message: ${error.message}`);
        if (error.stack) {
          this.logger.error(`  Stack: ${error.stack.substring(0, 500)}`);
        }
      }

      if (error.response) {
        let errorMessage =
          error.response.data?.message || error.response.statusText || error.message;

        // Handle HTML error responses (common for AGROmonitoring validation errors)
        if (
          typeof error.response.data === 'string' &&
          error.response.data.includes('<!doctype html>')
        ) {
          this.logger.error(
            '  AGROmonitoring API returned HTML error page. Attempting to extract error message.',
          );

          // Try to extract error message from HTML
          const htmlMatch = error.response.data.match(/<h1>([^<]+)<\/h1>/);
          if (htmlMatch) {
            errorMessage = htmlMatch[1].trim();
          } else {
            // Look for error message in common HTML patterns
            const textMatch = error.response.data.match(/>([^<]*(?:error|Error|ERROR)[^<]*)</);
            if (textMatch) {
              errorMessage = textMatch[1].trim();
            }
          }
        }

        throw new BadRequestException(`AGROmonitoring API error: ${errorMessage}`);
      }
      throw new BadRequestException(`AGROmonitoring API request failed: ${error.message}`);
    }
  }

  /**
   * Make request with automatic retry on rate limit (429) errors
   */
  protected async makeRequestWithRetry<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    retryCount = 0,
  ): Promise<T> {
    try {
      return await this.makeRequestInternal<T>(method, endpoint, data);
    } catch (error: any) {
      // Handle rate limit (429) errors
      if (error.response?.status === 429 && retryCount < this.MAX_RETRIES) {
        const retryAfter = error.response.data?.retry_after || this.RATE_LIMIT_RETRY_DELAY;
        this.logger.warn(
          `Rate limit exceeded. Waiting ${retryAfter}ms before retry (attempt ${retryCount + 1}/${this.MAX_RETRIES})`,
        );
        await this.sleep(retryAfter);
        return this.makeRequestWithRetry<T>(method, endpoint, data, retryCount + 1);
      }

      // Re-throw if not rate limit or max retries reached
      throw error;
    }
  }

  /**
   * Poll async task until completion
   *
   * @param checkTaskFn Function that checks task status
   * @param maxAttempts Maximum polling attempts (default: 15)
   * @param initialDelay Initial delay in ms (default: 2000)
   * @returns Task result when completed
   */
  protected async pollAsyncTask<T>(
    checkTaskFn: () => Promise<AsyncTaskResponse>,
    maxAttempts = 15,
    initialDelay = 2000,
  ): Promise<T> {
    let delay = initialDelay;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await checkTaskFn();

      if (response.status === 'completed' || response.status === 'success') {
        this.logger.debug(`Task completed successfully after ${attempt + 1} attempts`);
        return response.result as T;
      }

      if (response.status === 'failed') {
        const errorMsg = response.error || 'Task processing failed';
        this.logger.error(`Task failed: ${errorMsg}`);
        throw new BadRequestException(`AGROmonitoring task failed: ${errorMsg}`);
      }

      // Task still processing
      if (response.progress) {
        this.logger.debug(
          `Task progress: ${response.progress}% (attempt ${attempt + 1}/${maxAttempts})`,
        );
      } else {
        this.logger.debug(`Task processing... (attempt ${attempt + 1}/${maxAttempts})`);
      }

      // Wait before next check with exponential backoff
      await this.sleep(delay);
      delay = Math.min(delay * 1.5, 30000); // Max 30 seconds
    }

    throw new BadRequestException(`Task did not complete within ${maxAttempts} attempts (timeout)`);
  }

  /**
   * Sleep utility for delays
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
