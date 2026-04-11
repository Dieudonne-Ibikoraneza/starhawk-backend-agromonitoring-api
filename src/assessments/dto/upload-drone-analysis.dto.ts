import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PdfType {
  PLANT_HEALTH = 'plant_health',
  FLOWERING = 'flowering',
  /** Single canonical report for field assessments (replaces choosing plant vs flowering in UI). */
  DRONE_ANALYSIS = 'drone_analysis',
}

export class UploadDroneAnalysisDto {
  @ApiProperty({
    enum: PdfType,
    description: 'Type of PDF being uploaded',
    example: PdfType.PLANT_HEALTH,
  })
  @IsEnum(PdfType)
  pdfType: PdfType;
}

export class PdfInfoDto {
  @ApiProperty({
    enum: PdfType,
    description: 'Type of PDF',
    example: PdfType.PLANT_HEALTH,
  })
  pdfType: PdfType;

  @ApiProperty({
    description: 'URL of the uploaded PDF',
    example: '/uploads/drone-analysis/plant-health-1234567890-abc123.pdf',
  })
  pdfUrl: string;

  @ApiPropertyOptional({
    description: 'Drone analysis data extracted from the PDF',
    type: 'object',
    additionalProperties: true,
  })
  droneAnalysisData?: object;

  @ApiProperty({
    description: 'Timestamp when the PDF was uploaded',
    example: '2023-12-01T10:30:00.000Z',
  })
  uploadedAt: Date;
}
