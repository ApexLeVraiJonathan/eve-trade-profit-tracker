// DTOs for ESI operations

export interface EsiStatusDto {
  success: boolean;
  data: {
    connected: boolean;
    rateLimitRemaining: number;
    rateLimitReset: number;
    lastSuccessfulCall?: string;
    totalCalls: number;
    errors: number;
  };
}

export interface EsiMarketPricesDto {
  success: boolean;
  data: {
    regionId: number;
    regionName: string;
    orders: Array<{
      itemTypeId: number;
      itemTypeName: string;
      locationId: string;
      orderType: 'buy' | 'sell';
      price: string;
      volume: number;
      minVolume?: number;
      duration: number;
      issued: string;
      orderRange: string;
    }>;
    fetchedAt: string;
    totalOrders: number;
  };
}

export interface EsiItemVolumeDto {
  success: boolean;
  data: Array<{
    itemTypeId: number;
    itemTypeName: string;
    volume: number;
    updated: boolean;
  }>;
  stats: {
    totalProcessed: number;
    updated: number;
    errors: number;
  };
}

export interface EsiErrorDto {
  success: false;
  error: string;
  details?: string;
  timestamp: string;
}
