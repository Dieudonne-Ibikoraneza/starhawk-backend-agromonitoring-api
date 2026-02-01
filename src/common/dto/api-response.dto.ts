import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty()
  pageNumber: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalElements: number;

  @ApiProperty()
  totalPages: number;
}

export class ApiResponseDto<T> {
  @ApiProperty()
  message: string;

  @ApiProperty()
  data: T;

  @ApiProperty()
  success: boolean;

  @ApiProperty({ required: false })
  pagination?: PaginationMetaDto;
}

