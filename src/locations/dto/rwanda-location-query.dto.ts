import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

const normalizeQueryValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class RwandaLocationQueryDto {
  @ApiPropertyOptional({
    description: 'Province slug or name. Supports aliases like east, west, kigali.',
    example: 'east',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => normalizeQueryValue(value))
  p?: string;

  @ApiPropertyOptional({
    description: 'District slug or name.',
    example: 'ngoma',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => normalizeQueryValue(value))
  d?: string;

  @ApiPropertyOptional({
    description: 'Sector slug or name.',
    example: 'kibungo',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => normalizeQueryValue(value))
  s?: string;

  @ApiPropertyOptional({
    description: 'Cell slug or name.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => normalizeQueryValue(value))
  c?: string;

  @ApiPropertyOptional({
    description: 'Village slug or name.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => normalizeQueryValue(value))
  v?: string;

  @ApiPropertyOptional({
    description: 'Free-text search across the requested level.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => normalizeQueryValue(value))
  q?: string;
}

