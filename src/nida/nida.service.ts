import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DocumentRequestDto } from './dto/document-request.dto';
import { NidaResponseDto } from './dto/nida-response.dto';

@Injectable()
export class NidaService {
  private readonly nidaApiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.nidaApiUrl =
      this.configService.get<string>(
        'NIDA_API_URL',
        'https://prod.safaribus.rw/nxreporting/nida',
      ) + '/document';
  }

  async verifyDocument(nationalId: string): Promise<NidaResponseDto> {
    try {
      const request: DocumentRequestDto = {
        document_number: nationalId,
      };

      const response = await firstValueFrom(
        this.httpService.post<NidaResponseDto>(this.nidaApiUrl, request, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }),
      );

      // Validate response
      if (response.status !== 200) {
        throw new BadRequestException(
          `NIDA API returned status ${response.status}`,
        );
      }

      if (!response.data || !response.data.data) {
        throw new BadRequestException('NIDA API returned empty data');
      }

      // Validate required fields
      const data = response.data.data;
      if (
        !data ||
        !data.foreName ||
        !data.surnames ||
        !data.province ||
        !data.district ||
        !data.sector ||
        !data.cell ||
        !data.village ||
        !data.sex
      ) {
        throw new BadRequestException('NIDA response missing required fields');
      }

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new BadRequestException(
          `NIDA API error: ${error.response.data?.message || error.message}`,
        );
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to verify document with NIDA: ${error.message}`,
      );
    }
  }
}

