// Interfaces for Liquidity Analysis

export interface LiquidityCriteria {
  minDaysPerWeek?: number; // Minimum days per week traded (default: 4)
  minValue?: number; // Minimum average ISK value (default: 1M ISK)
}
