// Core arbitrage calculation interfaces

// New streamlined arbitrage opportunity focused on practical trading data
export interface ArbitrageOpportunity {
  // Core item info
  itemTypeId: number;
  itemTypeName: string;

  // Hub routing (solar system names)
  fromHub: string; // e.g., "Jita"
  toHub: string; // e.g., "Amarr"

  // Key metrics for trading decisions
  margin: number; // Gross margin percentage
  possibleProfit: number; // Net profit in ISK
  daysTraded: number; // Days per week traded from liquidity analysis
  totalAmountTradedPerWeek: number; // Total volume traded weekly
  iskPerM3: number; // Profit density (ISK per cubic meter)

  // Historical price data from actual trades at destination
  recordedPriceLow: number; // Lowest recorded trade price in analysis period
  recordedPriceHigh: number; // Highest recorded trade price in analysis period
  recordedPriceAverage: number; // Average recorded trade price in analysis period

  // Price validation to prevent inflated opportunities
  priceValidation?: {
    rawMarketPrice: number; // Original current market price
    validatedPrice: number; // Price used in calculations (may be capped by historical data)
    wasAdjusted: boolean; // True if price was reduced due to historical data
    adjustment: number; // Amount price was reduced (0 if not adjusted)
    reason: string; // Explanation of why price was adjusted
  };

  // Detailed breakdown (for advanced users)
  details?: {
    itemTypeId: number;
    itemTypeName: string;
    volume: number; // m³ per unit

    buyHub: {
      stationId: string;
      stationName: string;
      solarSystemName: string;
      regionId: number;
      regionName: string;
      bestBuyPrice: number;
      availableVolume: number;
      totalValue: number;
    };

    sellHub: {
      stationId: string;
      stationName: string;
      solarSystemName: string;
      regionId: number;
      regionName: string;
      bestSellPrice: number;
      demandVolume: number;
      totalValue: number;
    };

    profitAnalysis: {
      grossMargin: number;
      grossMarginPercent: number;
      netProfit: number;
      netProfitPercent: number;
      profitPerM3: number;
      roi: number;
    };

    costs: {
      buyPrice: number;
      sellPrice: number;
      salesTax: number;
      brokerFee: number;
      totalCost: number;
      totalRevenue: number;
    };

    logistics: {
      recommendedQuantity: number;
      totalCargo: number;
      shipmentsNeeded: number;
      cargoEfficiency: number;
    };

    metadata: {
      calculatedAt: Date;
      buyOrderAge: number;
      sellOrderAge: number;
      spreadPercent: number;
      confidence: 'high' | 'medium' | 'low';
    };
  };
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

export interface TaxCalculation {
  salesTax: number; // Default 2.25%, reducible with Accounting skill
  brokerFee: number; // Default 2.25%, reducible with Broker Relations skill
  totalTaxRate: number; // Combined tax rate
  accountingLevel: number; // 0-5, reduces sales tax
  brokerRelationsLevel: number; // 0-5, reduces broker fees
  standings: number; // -10 to 10, affects broker fees
}

export interface LogisticsCalculation {
  cargoCapacity: number; // Default 60,000 m³ for freighter
  itemVolume: number; // m³ per unit
  maxUnitsPerTrip: number; // Based on cargo capacity
  shipmentsRequired: number;
  wastedSpace: number; // Unused cargo space in m³
  efficiency: number; // Percentage of cargo space utilized

  // Additional properties for arbitrage compatibility
  recommendedQuantity: number;
  totalCargo: number; // Total m³ for recommended quantity
  totalVolume: number; // Alias for totalCargo
  shipmentsNeeded: number; // Alias for shipmentsRequired
  cargoEfficiency: number; // Alias for efficiency
}

export interface ArbitrageFilters {
  minProfit?: number; // Minimum ISK profit
  minMarginPercent?: number; // Minimum margin percentage
  maxCargoVolume?: number; // Maximum total cargo in m³
  maxInvestment?: number; // Maximum ISK investment
  minProfitPerM3?: number; // Minimum profit per cubic meter
  stationIds?: string[]; // Specific stations to consider
  itemTypeIds?: number[]; // Specific items to analyze
  excludeHighRisk?: boolean; // Filter out old/small orders

  // Hub filtering (solar system names)
  fromHub?: string; // Source hub filter (e.g., "Jita")
  toHub?: string; // Destination hub filter (e.g., "Amarr")

  // Sorting and pagination
  sortBy?: 'profit' | 'margin' | 'profitPerM3' | 'roi' | 'daysTraded';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export interface ArbitrageSummary {
  totalOpportunities: number;
  totalPotentialProfit: number;
  averageMargin: number;
  topOpportunities: ArbitrageOpportunity[];
  byHub: Array<{
    hubName: string;
    opportunities: number;
    totalProfit: number;
  }>;
  byCategory: Array<{
    category: string;
    opportunities: number;
    avgProfitPerM3: number;
  }>;
}

export interface TradingHub {
  name: string;
  stationId: bigint;
  systemName: string;
  fullStationName: string;
}

export interface MultiHubArbitrageParams {
  sourceHub: string;
  destinationHubs: string[];
  filters?: ArbitrageFilters;
}

export interface TradingMetrics {
  tradesPerWeek: number;
  totalAmountTradedPerWeek: number;
}
