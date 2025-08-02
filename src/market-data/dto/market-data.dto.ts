// DTOs for Market Data operations

export interface MarketOrderTradeDto {
  id: number;
  locationId: string; // BigInt as string
  regionId: number;
  typeId: number;
  isBuyOrder: boolean;
  hasGone: boolean;
  scanDate: string; // ISO date string
  amount: string; // BigInt as string
  high: string; // Decimal as string
  low: string; // Decimal as string
  avg: string; // Decimal as string
  orderNum: number;
  iskValue: string; // BigInt as string

  // Optional related data
  regionName?: string;
  itemTypeName?: string;
  stationName?: string;
}

export interface MarketDataImportResultDto {
  success: boolean;
  message: string;
  data: {
    totalProcessed: number;
    imported: number;
    skipped: number;
    errors: number;
    trackedStationsFound: number;
    importDuration: string; // Duration in human readable format
  };
}

export interface MarketDataStatsDto {
  success: boolean;
  data: {
    totalRecords: number;
    dateRange: {
      earliest: string; // ISO date string
      latest: string; // ISO date string
    };
    byStation: Array<{
      stationId: string;
      stationName: string;
      recordCount: number;
    }>;
    byItemType: Array<{
      typeId: number;
      typeName: string;
      recordCount: number;
    }>;
  };
}

export interface MarketDataQueryDto {
  stationIds?: string[]; // Array of BigInt as strings
  typeIds?: number[];
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  isBuyOrder?: boolean;
  limit?: number;
  offset?: number;
}

export interface MarketDataQueryResultDto {
  success: boolean;
  data: {
    trades: MarketOrderTradeDto[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

// Generic response DTO for market data operations
export interface MarketDataResponseDto<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}
