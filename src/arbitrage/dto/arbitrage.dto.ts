// DTOs for arbitrage API endpoints

export interface ArbitrageOpportunityDto {
  itemTypeId: number;
  itemTypeName: string;
  volume: number;

  buyHub: {
    stationId: string;
    stationName: string;
    regionName: string;
    bestBuyPrice: string; // Decimal as string
    availableVolume: number;
    totalValue: string; // Decimal as string
  };

  sellHub: {
    stationId: string;
    stationName: string;
    regionName: string;
    bestSellPrice: string; // Decimal as string
    demandVolume: number;
    totalValue: string; // Decimal as string
  };

  profitAnalysis: {
    grossMargin: string; // Decimal as string
    grossMarginPercent: number;
    netProfit: string; // Decimal as string
    netProfitPercent: number;
    profitPerM3: string; // Decimal as string
    roi: number;
  };

  costs: {
    buyPrice: string;
    sellPrice: string;
    salesTax: string;
    brokerFee: string;
    totalCost: string;
    totalRevenue: string;
  };

  logistics: {
    recommendedQuantity: number;
    totalCargo: number;
    shipmentsNeeded: number;
    cargoEfficiency: number;
  };

  metadata: {
    calculatedAt: string; // ISO date string
    buyOrderAge: number;
    sellOrderAge: number;
    spreadPercent: number;
    confidence: 'high' | 'medium' | 'low';
  };
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
  sortBy?: 'profit' | 'margin' | 'profitPerM3' | 'roi';
  sortOrder?: 'asc' | 'desc';
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
