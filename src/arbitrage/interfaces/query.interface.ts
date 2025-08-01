// Query parameter interfaces for type safety

export interface ArbitrageQueryParams {
  minProfit?: string;
  minMarginPercent?: string;
  maxCargoVolume?: string;
  maxInvestment?: string;
  minProfitPerM3?: string;
  excludeHighRisk?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface ArbitrageSummaryQueryParams {
  minProfit?: string;
  minMarginPercent?: string;
  excludeHighRisk?: string;
}

export interface ArbitrageCalculationBody {
  itemTypeId: number;
  buyStationId: string;
  sellStationId: string;
  quantity: number;
}

// Type guard functions
export function parseOptionalFloat(
  value: string | undefined,
): number | undefined {
  if (!value) return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

export function parseOptionalInt(
  value: string | undefined,
): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

export function parseOptionalBoolean(value: string | undefined): boolean {
  return value === 'true';
}

export function isValidSortBy(
  value: string | undefined,
): value is 'profit' | 'margin' | 'profitPerM3' | 'roi' {
  return (
    value === 'profit' ||
    value === 'margin' ||
    value === 'profitPerM3' ||
    value === 'roi'
  );
}

export function isValidSortOrder(
  value: string | undefined,
): value is 'asc' | 'desc' {
  return value === 'asc' || value === 'desc';
}
