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
  // Basic packing info
  itemTypeId: number;
  itemName: string;
  quantity: number;
  totalCost: number;
  totalCargo: number;
  profit: number;
  profitPerM3: number;

  // Full arbitrage opportunity data (includes price validation)
  originalOpportunity: {
    fromHub: string;
    toHub: string;
    margin: number;
    possibleProfit: number;
    daysTraded: number;
    totalAmountTradedPerWeek: number;
    iskPerM3: number;
    recordedPriceLow: number;
    recordedPriceHigh: number;
    recordedPriceAverage: number;
    priceValidation?: {
      rawMarketPrice: number;
      validatedPrice: number;
      wasAdjusted: boolean;
      adjustment: number;
      reason: string;
    };
    details?: any; // Full details object from arbitrage opportunity
  };
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

  // Enhanced stats showing which algorithm achieved each metric
  winners: {
    bestProfit: {
      algorithm: string;
      value: number;
      display: string;
    };
    bestUtilization: {
      algorithm: string;
      value: number;
      display: string;
    };
    fastestExecution: {
      algorithm: string;
      value: number;
      display: string;
    };
  };
}
