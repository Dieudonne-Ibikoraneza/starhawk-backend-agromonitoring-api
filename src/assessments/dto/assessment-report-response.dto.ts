import { ApiProperty } from '@nestjs/swagger';

export class AssessmentReportResponseDto {
  @ApiProperty({ description: 'Assessment ID' })
  assessmentId: string;

  @ApiProperty({ description: 'Farm details' })
  farmDetails: any;

  @ApiProperty({ 
    description: 'Array of uploaded drone analysis PDFs with their extracted data',
    type: 'array',
    isArray: true,
    required: false
  })
  droneAnalysisPdfs?: {
    pdfType: 'plant_health' | 'flowering' | 'drone_analysis';
    pdfUrl: string;
    droneAnalysisData?: object;
    uploadedAt: Date;
  }[];

  @ApiProperty({ description: 'Comprehensive assessment notes' })
  comprehensiveNotes: string;

  @ApiProperty({ description: 'Weather data from EOSDA' })
  weatherData: any;

  @ApiProperty({ description: 'Report generation metadata' })
  metadata: {
    reportGenerated: boolean;
    reportGeneratedAt: Date;
    status: string;
  };
}





