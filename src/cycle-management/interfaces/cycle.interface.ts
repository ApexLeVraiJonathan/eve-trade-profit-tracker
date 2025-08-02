export interface CycleAllocation {
  hub: string;
  capital: number;
  percentage: number;
  transportCost: number; // Cost per 60km³ shipment
  maxShipments: number; // Maximum profitable shipments
}

export interface CycleOpportunity {
  itemTypeId: number;
  itemName: string;
  buyPrice: number;
  sellPrice: number;
  margin: number;
  profit: number;
  profitPerM3: number;
  quantity: number;
  totalCost: number;
  totalCargo: number;
  shipmentsNeeded: number;
  transportCost: number;
  netProfitAfterTransport: number;
  recordedPriceLow: number;
  recordedPriceHigh: number;
  recordedPriceAverage: number;
  liquidity: number; // Days traded per week
}

export interface CycleAllocationResult {
  hub: string;
  capital: number;
  percentage: number;
  transportCost: number;
  maxShipments: number;
  opportunities: CycleOpportunity[];
  totalValue: number;
  totalProfit: number;
  totalTransportCost: number;
}

export interface CycleOpportunitiesResponse {
  cycleId: string;
  sourceHub: string;
  totalCapital: number;
  allocations: Record<string, CycleAllocationResult>;
  summary: {
    totalOpportunities: number;
    totalValue: number;
    totalProfit: number;
    totalTransportCost: number;
    averageMargin: number;
  };
}

export interface CycleFilters {
  minMarginPercent?: number;
  minLiquidity?: number;
  maxItemsPerHub?: number;
}

export interface CycleConfig {
  sourceHub: string;
  totalCapital: number;
  allocations: Record<string, number>;
  filters: CycleFilters;
}

// Algorithm comparison interfaces
export interface PackedItem {
  itemTypeId: number;
  itemName: string;
  quantity: number;
  totalCost: number;
  totalCargo: number;
  profit: number;
  profitPerM3: number;
}

export interface PackingResult {
  items: PackedItem[];
  totalProfit: number;
  cargoUtilization: number; // Percentage
  totalItems: number;
  executionTimeMs: number;
  algorithm: string;
}

export interface AlgorithmComparison {
  maxProfit: number;
  maxUtilization: number;
  minTime: number;
  profitDifference: number;
  speedDifference: number;
  recommendation: string;
}
