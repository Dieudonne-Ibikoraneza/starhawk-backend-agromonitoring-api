import { ApiProperty } from '@nestjs/swagger';

export class AssessmentReportResponseDto {
  @ApiProperty({ description: 'Assessment ID' })
  assessmentId: string;

  @ApiProperty({ description: 'Farm details' })
  farmDetails: any;

  @ApiProperty({ description: 'Drone analysis data extracted from PDF', required: false })
  droneAnalysisData?: any;

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





