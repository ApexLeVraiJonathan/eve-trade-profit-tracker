// Market data interfaces for arbitrage calculations

export interface MarketPrice {
  itemTypeId: number;
  regionId: number;
  locationId: bigint;
  orderType: 'buy' | 'sell';
  price: number;
  volume: number;
  issued: Date;
  minVolume?: number;
  duration?: number;
  orderRange?: string;
}

export interface MarketPriceWithItemInfo extends MarketPrice {
  itemTypeName?: string;
  itemTypeVolume?: number;
}

export interface StationInfo {
  id: bigint;
  name: string;
  regionId: number;
  regionName: string;
}

export interface ItemTypeInfo {
  id: number;
  name: string;
  volume: number | null;
}

export interface GroupedMarketPrices {
  [itemTypeId: string]: MarketPrice[];
}

// Import ESI interface
import { EsiMarketPrice } from '../../esi/interfaces/esi.interface';

// Type guards for market data
export function isValidOrderType(value: string): value is 'buy' | 'sell' {
  return value === 'buy' || value === 'sell';
}

// Conversion function from ESI to internal format
export function convertEsiToMarketPrice(esiPrice: EsiMarketPrice): MarketPrice {
  return {
    itemTypeId: esiPrice.itemTypeId,
    regionId: esiPrice.regionId,
    locationId: BigInt(esiPrice.locationId), // Convert number to bigint
    orderType: esiPrice.orderType,
    price: esiPrice.price,
    volume: esiPrice.volume,
    issued: esiPrice.issued,
    minVolume: esiPrice.minVolume,
    duration: esiPrice.duration,
    orderRange: esiPrice.orderRange,
  };
}

export function isMarketPrice(obj: unknown): obj is MarketPrice {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    'itemTypeId' in candidate &&
    'regionId' in candidate &&
    'locationId' in candidate &&
    'orderType' in candidate &&
    'price' in candidate &&
    'volume' in candidate &&
    'issued' in candidate &&
    typeof candidate.itemTypeId === 'number' &&
    typeof candidate.regionId === 'number' &&
    (typeof candidate.locationId === 'bigint' ||
      typeof candidate.locationId === 'number') &&
    isValidOrderType(candidate.orderType as string) &&
    typeof candidate.price === 'number' &&
    typeof candidate.volume === 'number' &&
    candidate.issued instanceof Date
  );
}

export function isItemTypeInfo(obj: unknown): obj is ItemTypeInfo {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    'id' in candidate &&
    'name' in candidate &&
    'volume' in candidate &&
    typeof candidate.id === 'number' &&
    typeof candidate.name === 'string' &&
    (typeof candidate.volume === 'number' || candidate.volume === null)
  );
}

export function isStationInfo(obj: unknown): obj is StationInfo {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    'id' in candidate &&
    'name' in candidate &&
    'regionId' in candidate &&
    'regionName' in candidate &&
    (typeof candidate.id === 'bigint' || typeof candidate.id === 'number') &&
    typeof candidate.name === 'string' &&
    typeof candidate.regionId === 'number' &&
    typeof candidate.regionName === 'string'
  );
}
