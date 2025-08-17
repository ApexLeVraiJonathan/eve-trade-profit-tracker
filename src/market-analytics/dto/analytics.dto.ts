import { IsOptional, IsNumber, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LiquidItemData } from '../interfaces/liquidity.interface';

export class LiquidityQueryDto {
  @ApiProperty({
    description: 'Station ID to analyze liquidity for',
    example: '60003760',
  })
  @IsString()
  stationId!: string;

  @ApiPropertyOptional({
    description:
      'Minimum days per week an item must trade to be considered liquid',
    minimum: 1,
    maximum: 7,
    default: 4,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }: { value: any }) => parseInt(value as string))
  minDaysPerWeek?: number;

  @ApiPropertyOptional({
    description: 'Minimum average ISK value per week to be considered liquid',
    minimum: 0,
    default: 1000000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }: { value: any }) => parseInt(value as string))
  minValue?: number;
}

export class MultiStationLiquidityQueryDto {
  @ApiProperty({
    description: 'Comma-separated list of station IDs to analyze',
    example: '60003760,60008494,60011866',
  })
  @IsString()
  stationIds!: string;

  @ApiPropertyOptional({
    description:
      'Minimum days per week an item must trade to be considered liquid',
    minimum: 1,
    maximum: 7,
    default: 4,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }: { value: any }) => parseInt(value as string))
  minDaysPerWeek?: number;

  @ApiPropertyOptional({
    description: 'Minimum average ISK value per week to be considered liquid',
    minimum: 0,
    default: 1000000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }: { value: any }) => parseInt(value as string))
  minValue?: number;
}

export class LiquidityResponseDto {
  @ApiProperty({ description: 'Whether the request was successful' })
  success!: boolean;

  @ApiProperty({
    description: 'Array of liquid items meeting the criteria',
    type: [Object],
  })
  data!: LiquidItemData[];

  @ApiProperty({
    description: 'Additional metadata about the analysis',
  })
  metadata!: {
    stationId: string;
    analysisWindow: string;
    totalItemsAnalyzed: number;
    liquidItemsFound: number;
    criteria: {
      minDaysPerWeek: number;
      minValue: number;
    };
  };
}

export class MultiStationLiquidityResponseDto {
  @ApiProperty({ description: 'Whether the request was successful' })
  success!: boolean;

  @ApiProperty({
    description: 'Liquidity data grouped by station ID',
    type: Object,
  })
  data!: Record<string, LiquidItemData[]>;

  @ApiProperty({
    description: 'Analysis metadata',
  })
  metadata!: {
    stationsAnalyzed: number;
    totalLiquidItems: number;
    criteria: {
      minDaysPerWeek: number;
      minValue: number;
    };
  };
}

export class StationDebugResponseDto {
  @ApiProperty({ description: 'Whether the request was successful' })
  success!: boolean;

  @ApiProperty({
    description: 'Raw station trading data for debugging',
  })
  data!: {
    stationId: string;
    totalTrades: number;
    sellOrderTrades: number;
    buyOrderTrades: number;
    sampleTrades: Array<{
      typeId: string;
      isBuyOrder: boolean;
      amount: string;
      iskValue: string;
      scanDate: Date;
    }>;
  };
}
