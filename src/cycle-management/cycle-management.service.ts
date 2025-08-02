import { Injectable, Logger } from '@nestjs/common';
import { ArbitrageService } from '../arbitrage/arbitrage.service';
import { ArbitrageOpportunity } from '../arbitrage/interfaces/arbitrage.interface';
import {
  CycleOpportunitiesResponse,
  CycleAllocationResult,
  CycleOpportunity,
  CycleFilters,
} from './interfaces/cycle.interface';

@Injectable()
export class CycleManagementService {
  private readonly logger = new Logger(CycleManagementService.name);

  constructor(private readonly arbitrageService: ArbitrageService) {}

  /**
   * Get cycle opportunities with capital allocation and transport cost analysis
   * This is the main method for POC cycle planning
   */
  async getCycleOpportunities(
    sourceHub: string,
    totalCapital: number,
    allocations: Record<string, number> = {
      amarr: 0.5,
      dodixie: 0.3,
      hek: 0.1,
      rens: 0.1,
    },
    filters: CycleFilters = {},
  ): Promise<CycleOpportunitiesResponse> {
    const cycleId = `cycle_${Date.now()}`;
    const defaultFilters = {
      minMarginPercent: 15,
      minLiquidity: 1, // Temporarily reduced from 4 to 1 for debugging
      maxItemsPerHub: 20,
      ...filters,
    };

    // Transport costs per 60km³ shipment (based on jumps)
    const transportCosts: Record<string, number> = {
      amarr: 46 * 1500000, // 46 jumps × 1.5M ISK
      dodixie: 16 * 1500000, // 16 jumps × 1.5M ISK
      hek: 20 * 1500000, // 20 jumps × 1.5M ISK
      rens: 26 * 1500000, // 26 jumps × 1.5M ISK
    };

    this.logger.log(
      `Starting cycle planning: ${sourceHub} → ${Object.keys(allocations).join(', ')} with ${totalCapital.toLocaleString()} ISK`,
    );

    // Get all arbitrage opportunities
    const allOpportunities =
      await this.arbitrageService.findMultiHubArbitrageOpportunities({
        sourceHub,
        destinationHubs: Object.keys(allocations),
        filters: {
          minMarginPercent: defaultFilters.minMarginPercent,
          sortBy: 'profitPerM3',
          sortOrder: 'desc',
        },
      });

    // Group opportunities by destination hub
    const opportunitiesByHub = new Map<string, ArbitrageOpportunity[]>();
    allOpportunities.forEach((opp) => {
      if (!opportunitiesByHub.has(opp.toHub)) {
        opportunitiesByHub.set(opp.toHub, []);
      }
      opportunitiesByHub.get(opp.toHub)!.push(opp);
    });

    // Process each hub allocation
    const results: Record<string, CycleAllocationResult> = {};
    let totalOpportunities = 0;
    let totalValue = 0;
    let totalProfit = 0;
    let totalTransportCost = 0;

    for (const [hub, percentage] of Object.entries(allocations)) {
      const hubCapital = totalCapital * percentage;
      const transportCost = transportCosts[hub] || 0;
      const opportunities = opportunitiesByHub.get(hub) || [];

      this.logger.log(
        `Processing ${hub}: ${hubCapital.toLocaleString()} ISK (${(percentage * 100).toFixed(1)}%), ${opportunities.length} opportunities`,
      );

      // Filter opportunities by liquidity and convert to cycle format
      const cycleOpportunities: CycleOpportunity[] = opportunities
        .slice(0, defaultFilters.maxItemsPerHub)
        .map((opp) => {
          const itemVolume = opp.details?.volume || 1;
          const buyPrice = opp.details?.costs.buyPrice || 0;
          const quantity = buyPrice > 0 ? Math.floor(hubCapital / buyPrice) : 0;
          const totalCost = quantity * buyPrice;
          const totalCargo = quantity * itemVolume;
          const shipmentsNeeded = Math.ceil(totalCargo / 60000); // 60km³ per shipment
          const totalTransportCost = shipmentsNeeded * transportCost;
          const netProfitAfterTransport =
            opp.possibleProfit - totalTransportCost;

          return {
            itemTypeId: opp.itemTypeId,
            itemName: opp.itemTypeName,
            buyPrice,
            sellPrice: opp.details?.costs.sellPrice || 0,
            margin: opp.margin,
            profit: opp.possibleProfit,
            profitPerM3: opp.iskPerM3,
            quantity,
            totalCost,
            totalCargo,
            shipmentsNeeded,
            transportCost,
            netProfitAfterTransport,
            recordedPriceLow: opp.recordedPriceLow,
            recordedPriceHigh: opp.recordedPriceHigh,
            recordedPriceAverage: opp.recordedPriceAverage,
            liquidity: opp.tradesPerWeek, // Using tradesPerWeek as fallback since daysTraded not available
          };
        })
        .filter((opp) => {
          // Debug logging
          this.logger.debug(
            `After transport: ${opp.itemName} netProfit=${opp.netProfitAfterTransport}`,
          );
          return opp.netProfitAfterTransport > 0;
        }) // Only profitable after transport
        .sort((a, b) => b.profitPerM3 - a.profitPerM3); // Sort by ISK/m³

      // Calculate totals for this hub
      const hubValue = cycleOpportunities.reduce(
        (sum, opp) => sum + opp.totalCost,
        0,
      );
      const hubProfit = cycleOpportunities.reduce(
        (sum, opp) => sum + opp.netProfitAfterTransport,
        0,
      );
      const hubTransportCost = cycleOpportunities.reduce(
        (sum, opp) => sum + opp.transportCost,
        0,
      );

      results[hub] = {
        hub,
        capital: hubCapital,
        percentage,
        transportCost,
        maxShipments: Math.floor(hubCapital / transportCost),
        opportunities: cycleOpportunities,
        totalValue: hubValue,
        totalProfit: hubProfit,
        totalTransportCost: hubTransportCost,
      };

      totalOpportunities += cycleOpportunities.length;
      totalValue += hubValue;
      totalProfit += hubProfit;
      totalTransportCost += hubTransportCost;
    }

    const averageMargin =
      allOpportunities.length > 0
        ? allOpportunities.reduce((sum, opp) => sum + opp.margin, 0) /
          allOpportunities.length
        : 0;

    this.logger.log(
      `Cycle planning complete: ${totalOpportunities} opportunities, ${totalValue.toLocaleString()} ISK value, ${totalProfit.toLocaleString()} ISK profit`,
    );

    return {
      cycleId,
      sourceHub,
      totalCapital,
      allocations: results,
      summary: {
        totalOpportunities,
        totalValue,
        totalProfit,
        totalTransportCost,
        averageMargin,
      },
    };
  }
}
