import { ApiProperty } from '@nestjs/swagger';

export class MonitoringAlertResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  farmId: string;

  @ApiProperty({ description: 'Display name of the farm' })
  farmName: string;

  @ApiProperty()
  type: string;

  @ApiProperty({ description: 'low | medium | high | critical' })
  severity: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  read: boolean;
}
