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

export interface MarketDataFilters {
  stationIds?: bigint[];
  typeIds?: number[];
  startDate?: Date;
  endDate?: Date;
  isBuyOrder?: boolean;
  limit?: number;
  offset?: number;
}
