import { IsOptional, IsBoolean, IsInt, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class MarketOrderTradeDto {
  id!: number;
  locationId!: string;
  regionId!: number;
  typeId!: number;
  isBuyOrder!: boolean;
  hasGone!: boolean;
  scanDate!: Date;
  amount!: string;
  high!: number;
  low!: number;
  avg!: number;
  orderNum!: number;
  iskValue!: string;
  regionName!: string;
  itemTypeName!: string;
  stationName!: string;
}

export class MarketDataQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: any }): string[] =>
    typeof value === 'string' ? value.split(',') : value,
  )
  stationIds?: string[];

  @IsOptional()
  @Transform(({ value }: { value: any }): number[] =>
    typeof value === 'string' ? value.split(',').map(Number) : value,
  )
  typeIds?: number[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: any }): boolean => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  isBuyOrder?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  offset?: number;
}

export class MarketDataImportResultDto {
  success!: boolean;
  message!: string;
  data?: {
    totalProcessed: number;
    imported: number;
    skipped: number;
    errors: number;
    trackedStationsFound: number;
    importDuration: string;
  };
}

export class MarketDataQueryResultDto {
  success!: boolean;
  data?: {
    trades: MarketOrderTradeDto[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

export class MarketDataStatsDto {
  success!: boolean;
  data?: {
    totalRecords: number;
    uniqueStations: number;
    uniqueItems: number;
    dateRange: {
      earliest: Date | null;
      latest: Date | null;
    };
    recentActivity: {
      last24Hours: number;
    };
    lastUpdated: Date;
  };
}

export class MarketDataResponseDto {
  success!: boolean;
  message?: string;
  data?: any;
}
