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
  tradesPerWeek: number; // Trading frequency from historical data
  totalAmountTradedPerWeek: number; // Total volume traded weekly
  iskPerM3: number; // Profit density (ISK per cubic meter)

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
  optimalQuantity: number; // Based on market depth and capital
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
  sortBy?: 'profit' | 'margin' | 'profitPerM3' | 'roi' | 'tradesPerWeek';
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
