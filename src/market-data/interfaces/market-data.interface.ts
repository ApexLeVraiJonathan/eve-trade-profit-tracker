// Interfaces for Market Data CSV processing and internal operations

export interface MarketDataCsvRow {
  location_id: string;
  region_id: string;
  type_id: string;
  is_buy_order: string;
  has_gone: string;
  scanDate: string;
  amount: string;
  high: string;
  low: string;
  avg: string;
  orderNum: string;
  iskValue: string;
}

export interface ProcessedMarketDataRow {
  locationId: bigint;
  regionId: number;
  typeId: number;
  isBuyOrder: boolean;
  hasGone: boolean;
  scanDate: Date;
  amount: bigint;
  high: number;
  low: number;
  avg: number;
  orderNum: number;
  iskValue: bigint;
}

export interface MarketDataImportStats {
  totalProcessed: number;
  imported: number;
  skipped: number;
  errors: number;
  trackedStationsFound: number;
  startTime: Date;
  endTime: Date;
}

export interface TrackedStationInfo {
  id: number;
  stationId: bigint;
  name: string;
  isActive: boolean;
  addedDate: Date;
  notes?: string;
}

// Query filters for market data
export interface MarketDataFilters {
  stationIds?: bigint[];
  typeIds?: number[];
  startDate?: Date;
  endDate?: Date;
  isBuyOrder?: boolean;
  limit?: number;
  offset?: number;
}

// Market data aggregation results
export interface PriceStatistics {
  itemTypeId: number;
  itemTypeName: string;
  stationId: bigint;
  stationName: string;
  avgBuyPrice: number;
  avgSellPrice: number;
  buyVolume: bigint;
  sellVolume: bigint;
  spread: number; // Difference between buy and sell
  spreadPercentage: number;
  lastUpdated: Date;
}
