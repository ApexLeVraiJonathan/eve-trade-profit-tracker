// ESI API response interfaces

export interface EsiMarketOrder {
  order_id: number;
  type_id: number;
  location_id: number;
  volume_total: number;
  volume_remain: number;
  min_volume: number;
  price: number;
  is_buy_order: boolean;
  duration: number;
  issued: string; // ISO date string
  range: string;
}

export interface EsiTypeInfo {
  type_id: number;
  name: string;
  description: string;
  published: boolean;
  group_id: number;
  volume: number;
  capacity?: number;
  portion_size?: number;
  mass?: number;
}

export interface EsiMarketPrice {
  itemTypeId: number;
  itemTypeName: string;
  regionId: number;
  locationId: number;
  orderType: 'buy' | 'sell';
  price: number;
  volume: number;
  minVolume?: number;
  duration: number;
  issued: Date;
  orderRange: string;
}

export interface EsiRateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
}

export interface EsiErrorLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
}

// Generic ESI API response wrapper (unified interface)
export interface EsiApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  rateLimit?: EsiRateLimitInfo;
}

// ESI Market Orders API response
export interface EsiMarketOrdersResponse {
  [index: number]: EsiMarketOrder;
}

// ESI Type Information API response
export interface EsiTypeInfoResponse {
  type_id: number;
  name: string;
  description: string;
  published: boolean;
  group_id: number;
  volume?: number;
  capacity?: number;
  portion_size?: number;
  mass?: number;
}
