// Core arbitrage calculation interfaces

export interface ArbitrageOpportunity {
  itemTypeId: number;
  itemTypeName: string;
  volume: number; // m³ per unit

  buyHub: {
    stationId: string;
    stationName: string;
    regionId: number;
    regionName: string;
    bestBuyPrice: number;
    availableVolume: number;
    totalValue: number; // bestBuyPrice * recommendedQuantity
  };

  sellHub: {
    stationId: string;
    stationName: string;
    regionId: number;
    regionName: string;
    bestSellPrice: number;
    demandVolume: number;
    totalValue: number; // bestSellPrice * recommendedQuantity
  };

  profitAnalysis: {
    grossMargin: number; // Sell price - buy price
    grossMarginPercent: number; // (grossMargin / buyPrice) * 100
    netProfit: number; // After all taxes and fees
    netProfitPercent: number; // (netProfit / totalCost) * 100
    profitPerM3: number; // Net profit per cubic meter
    roi: number; // Return on investment percentage
  };

  costs: {
    buyPrice: number;
    sellPrice: number;
    salesTax: number; // 2.25% default
    brokerFee: number; // 2.25% default
    totalCost: number; // buyPrice + fees
    totalRevenue: number; // sellPrice - taxes
  };

  logistics: {
    recommendedQuantity: number; // Optimal quantity to trade
    totalCargo: number; // Total m³ for recommended quantity
    shipmentsNeeded: number; // Based on 60,000 m³ freighter
    cargoEfficiency: number; // Percentage of cargo space used
  };

  metadata: {
    calculatedAt: Date;
    buyOrderAge: number; // Hours since order was issued
    sellOrderAge: number; // Hours since order was issued
    spreadPercent: number; // Price difference as percentage
    confidence: 'high' | 'medium' | 'low'; // Based on volume/age
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

  // Sorting and pagination
  sortBy?: 'profit' | 'margin' | 'profitPerM3' | 'roi';
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
