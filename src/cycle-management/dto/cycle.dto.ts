import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class CycleSummaryDto {
  @IsNumber()
  totalOpportunities: number;

  @IsNumber()
  totalValue: number;

  @IsNumber()
  totalProfit: number;

  @IsNumber()
  totalTransportCost: number;

  @IsNumber()
  averageMargin: number;
}

export class CycleOpportunityDto {
  @IsNumber()
  itemTypeId: number;

  @IsString()
  itemName: string;

  @IsNumber()
  buyPrice: number;

  @IsNumber()
  sellPrice: number;

  @IsNumber()
  margin: number;

  @IsNumber()
  profit: number;

  @IsNumber()
  profitPerM3: number;

  @IsNumber()
  quantity: number;

  @IsNumber()
  totalCost: number;

  @IsNumber()
  totalCargo: number;

  @IsNumber()
  shipmentsNeeded: number;

  @IsNumber()
  transportCost: number;

  @IsNumber()
  netProfitAfterTransport: number;

  @IsNumber()
  recordedPriceLow: number;

  @IsNumber()
  recordedPriceHigh: number;

  @IsNumber()
  recordedPriceAverage: number;

  @IsNumber()
  liquidity: number;
}

export class CycleAllocationResultDto {
  @IsString()
  hub: string;

  @IsNumber()
  capital: number;

  @IsNumber()
  percentage: number;

  @IsNumber()
  transportCost: number;

  @IsNumber()
  maxShipments: number;

  @IsObject()
  opportunities: CycleOpportunityDto[];

  @IsNumber()
  totalValue: number;

  @IsNumber()
  totalProfit: number;

  @IsNumber()
  totalTransportCost: number;
}

export class CycleOpportunitiesDto {
  @IsString()
  cycleId: string;

  @IsString()
  sourceHub: string;

  @IsNumber()
  totalCapital: number;

  @IsObject()
  allocations: Record<string, CycleAllocationResultDto>;

  @IsObject()
  summary: CycleSummaryDto;
}

export class CycleFiltersDto {
  @IsOptional()
  @IsNumber()
  minMarginPercent?: number;

  @IsOptional()
  @IsNumber()
  minLiquidity?: number;

  @IsOptional()
  @IsNumber()
  maxItemsPerHub?: number;
}

export class CreateCycleDto {
  @IsString()
  sourceHub: string;

  @IsNumber()
  totalCapital: number;

  @IsOptional()
  @IsObject()
  allocations?: Record<string, number>;

  @IsOptional()
  @IsObject()
  filters?: CycleFiltersDto;
}
