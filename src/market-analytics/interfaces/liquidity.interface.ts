// Interfaces for Liquidity Analysis

export interface LiquidityCriteria {
  minDaysPerWeek?: number; // Minimum days per week traded (default: 4)
  minValue?: number; // Minimum average ISK value (default: 1M ISK)
}

// Enhanced liquidity data with price history
export interface LiquidItemData {
  typeId: number;
  daysTraded: number;
  totalValue: number;
  totalAmountTradedPerWeek: number; // Total units traded per week
  avgValue: number;
  priceData: {
    high: number; // Highest recorded price in period
    low: number; // Lowest recorded price in period
    average: number; // Average recorded price in period
  };
}
