// DTOs for arbitrage API endpoints

// NEW STREAMLINED DTO - exactly what user requested
export interface ArbitrageOpportunityDto {
  // 1. Item Name
  itemTypeName: string;

  // 2. Hub filtering (Jita -> Amarr format)
  fromHub: string; // Solar system name (e.g., "Jita")
  toHub: string; // Solar system name (e.g., "Amarr")

  // 3. Margin
  margin: number; // Gross margin percentage

  // 4. Possible profit
  possibleProfit: number; // Net profit in ISK

  // 5. Trades per week
  tradesPerWeek: number; // Trading frequency from historical data

  // 6. Total amount traded per week
  totalAmountTradedPerWeek: number; // Total volume traded weekly

  // 7. ISK/m³
  iskPerM3: number; // Profit density (ISK per cubic meter)

  // Historical recorded price data from actual trades at destination
  recordedPriceLow: number; // Lowest recorded trade price in analysis period
  recordedPriceHigh: number; // Highest recorded trade price in analysis period
  recordedPriceAverage: number; // Average recorded trade price in analysis period

  // DEBUG: Source and destination prices for verification
  buyPrice: number; // Price to buy at source
  sellPrice: number; // Price to sell at destination
}

export interface ArbitrageOpportunitiesDto {
  success: boolean;
  data: {
    opportunities: ArbitrageOpportunityDto[];
    summary: {
      totalOpportunities: number;
      totalPotentialProfit: string; // Decimal as string
      averageMargin: number;
      calculatedAt: string; // ISO date string
    };
    filters: {
      minProfit?: number;
      minMarginPercent?: number;
      maxCargoVolume?: number;
      maxInvestment?: number;
      appliedFilters: string[];
    };
  };
  message?: string;
}

export interface ArbitrageCalculationDto {
  success: boolean;
  data: {
    itemTypeId: number;
    itemTypeName: string;
    buyStationId: string;
    sellStationId: string;
    quantity: number;

    calculation: {
      buyPrice: string;
      sellPrice: string;
      grossProfit: string;
      netProfit: string;
      profitMargin: number;
      roi: number;
      profitPerM3: string;
    };

    costs: {
      itemCost: string;
      salesTax: string;
      brokerFees: string;
      totalCost: string;
    };

    logistics: {
      totalVolume: number;
      shipmentsNeeded: number;
      cargoEfficiency: number;
    };
  };
  message?: string;
}

export interface ArbitrageFiltersDto {
  minProfit?: number;
  minMarginPercent?: number;
  maxCargoVolume?: number;
  maxInvestment?: number;
  minProfitPerM3?: number;
  stationIds?: string[];
  itemTypeIds?: number[];
  excludeHighRisk?: boolean;
  limit?: number;
  sortBy?: 'profit' | 'margin' | 'profitPerM3' | 'roi' | 'tradesPerWeek'; // Added tradesPerWeek
  sortOrder?: 'asc' | 'desc';

  // Hub filtering (solar system names)
  fromHub?: string; // Source hub filter (e.g., "Jita")
  toHub?: string; // Destination hub filter (e.g., "Amarr")
}

export interface ArbitrageErrorDto {
  success: false;
  error: string;
  details?: string;
  timestamp: string;
}

export interface ArbitrageSummaryDto {
  success: boolean;
  data: {
    overview: {
      totalOpportunities: number;
      totalPotentialProfit: string;
      averageMargin: number;
      topProfitPerM3: string;
      lastUpdated: string;
    };

    byHub: Array<{
      hubName: string;
      stationId: string;
      opportunities: number;
      totalProfit: string;
      avgMargin: number;
    }>;

    byProfitability: Array<{
      range: string; // e.g., "1M-10M ISK"
      opportunities: number;
      avgMargin: number;
    }>;

    recommendations: string[];
  };
}
